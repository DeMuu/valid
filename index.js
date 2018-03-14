const fs = require('fs');
const path = require('path');
const spinner = require('cli-spinner').Spinner;
const chalk = require('chalk');
const looksSame = require('looks-same');
const puppeteer = require('puppeteer');


// set up a CLI spinner
const loadingSpinner = new spinner('Reading input config file ... %s');
// some fancy words for the lulz
const validatingSpinnerTitleList = [
  'Fetching pixels... %s',
  'Wielding image magic... %s',
  'Pretending to work... %s',
  'Analyzing data... %s'
];
// this index will be used to iterate over the list of links
let linkIndex = 0;
// this array will keep track of all the failed tests
let faultyLinksList = [];

const defaultTolerance = 2.5;

// helper function for a random number between `min` and `max`
const randomNumberInRange = (min, max) => Math.round(Math.random() * (max - min) + min);

// sets a random spinner string type
const setLoadingSpinnerType = () => {
  const randomSpinnerIndex = randomNumberInRange(0, spinner.spinners.length - 1);
  loadingSpinner.setSpinnerString(randomSpinnerIndex);
}

const validatePage = async (browserObj, pageObj, linkCollection, baseUrl, baseImageFolder) => {
  const currLinkItem = linkCollection[linkIndex];
  const spinnerTitleIndex = randomNumberInRange(0, validatingSpinnerTitleList.length - 1);

  setLoadingSpinnerType();
  
  console.log(chalk`Currently checking {yellow.italic ${baseUrl}${currLinkItem.path}}`);
  console.log(`Link #${linkIndex + 1}`);
  console.log(`Change expected: ${currLinkItem.didChange}`);
  console.log(`Diff tolerance: ${currLinkItem.tolerance || defaultTolerance}`);

  // set a random spinner text from the `validatingSpinnerTitleList` array and display it
  loadingSpinner.setSpinnerTitle(validatingSpinnerTitleList[spinnerTitleIndex]);
  loadingSpinner.start();

  try {
    await pageObj.goto(`${baseUrl}${currLinkItem.path}`, { waitUntil: 'networkidle0' });

    // if the requested path is the index page we need to manually set the name to index otherwise creating the image file would fail
    if (currLinkItem.path === '') {
      currLinkItem.path = 'index';
    }

    // if path contains sub paths we want to replace the slash characters with underscores to avoid exceptions when creating the image files
    if (currLinkItem.path.indexOf('/') > -1) {
      currLinkItem.path = currLinkItem.path.replace(/\//g, '_');
    }

    const expectedPath = `${baseImageFolder}expected/${currLinkItem.path}.png`;
    let savePath = expectedPath;
    let isFirstCapture = true;
    if (fs.existsSync(savePath)) {
      savePath = `${baseImageFolder}tmp/${currLinkItem.path}.png`;
      isFirstCapture = false;
    }

    // @TODO: add possibility to set cookies (e.g. for authentication)

    await pageObj.screenshot({path: savePath, fullPage: true});

    // savePath equals expectedPath means that it is the first time the current page is captured.
    // Therefore we want to copy the captured image to the tmp folder for comparison
    if (expectedPath === savePath) {
      fs.createReadStream(expectedPath).pipe(fs.createWriteStream(`${baseImageFolder}tmp/${currLinkItem.path}.png`));
    }

    looksSame(expectedPath, savePath, function (error, equal) {
      let testPassed = false;

      // we know the test failed if the diff result does not match the expected didChange value and it's not a first-time capture
      if ((!equal && !currLinkItem.didChange) || (equal && currLinkItem.didChange && !isFirstCapture)) {
        looksSame.createDiff({
          reference: expectedPath,
          current: savePath,
          diff: `${baseImageFolder}diff/${currLinkItem.path}.png`,
          highlightColor: '#ff00ff', //color to highlight the differences
          strict: false,//strict comparsion
          tolerance: currLinkItem.tolerance || defaultTolerance
        }, function(error) {
          // @TODO: evaluate if it makes sense to throw an exception or log a message here
        });
      }
      else {
        testPassed = true;
      }

      // if a diff is detected but it was expected we update the image file in the "expected" folder for future runs
      if (!equal && currLinkItem.didChange) {
        fs.createReadStream(savePath).pipe(fs.createWriteStream(`${baseImageFolder}expected/${currLinkItem.path}.png`));
      }

      loadingSpinner.stop(true);

      if (!testPassed) {
        faultyLinksList.push(currLinkItem);
      }

      console.log(`Test passed: ${testPassed ? chalk.green.bold('YES') : chalk.red.bold('NO')}`);
      console.log(chalk.bold('--------'));

      // check if we already validated all the links and otherwise recursively validate the next item
      if (linkCollection.length - 1 > linkIndex) {
        linkIndex++;
        validatePage(browserObj, pageObj, linkCollection, baseUrl, baseImageFolder);
        return;
      }

      console.log('\n\n');
      console.log(chalk.underline.bold('VALID Test Summary:'));
      
      if (faultyLinksList.length > 0) {
        faultyLinksList.forEach((item) => {
          const pathString = item.path;

          // if the requested path is the index page we need to manually set the name to index otherwise creating the image file would fail
          if (pathString === '') {
            pathString = 'index';
          }

          console.log(chalk`{red.underline ${pathString}} did not match the expected image.`);
        });

        console.log('--------');
        console.log(chalk`${faultyLinksList.length} tests are {red.bold NOT OK}`);
      }
      else {
        console.log(chalk.bold.green('All tests passed! You are good to go'));
      }

      browserObj.close();
    });
  }
  catch (exc) {
    loadingSpinner.stop(true);
    console.error(chalk.red.bold(exc));
  }
}

module.exports = (inputFile, checkMobile = false, mobileLandscape = false) => {
  if (!inputFile) {
    console.error(chalk.red('\n\nParameter inputFile is mandatory. Please use the --help flag if you want documentation.\n\n'));
    return;
  }

  console.log(chalk.green.underline.bold('VALID regression test is starting'))

  setLoadingSpinnerType();
  loadingSpinner.start();

  setTimeout(() => {
    fs.readFile(inputFile, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        throw err;
      }
  
      const fileData = JSON.parse(data);
      const linksCount = fileData.links.length;
      const baseImageFolder = fileData.config.baseImageFolder.slice(-1) === '/' ? fileData.config.baseImageFolder : fileData.config.baseImageFolder + '/';
  
      loadingSpinner.stop(true);

      // we need to create the necessary sub-directories to avoid exceptions when storing images later on
      if (!fs.existsSync(`${baseImageFolder}expected`)) {
        fs.mkdirSync(`${baseImageFolder}expected`);
        console.log(chalk`Creating directory: {underline ${baseImageFolder}expected}\n`);
      }
      if (!fs.existsSync(`${baseImageFolder}tmp`)) {
        fs.mkdirSync(`${baseImageFolder}tmp`);
        console.log(chalk`Creating directory: {underline ${baseImageFolder}tmp}\n`);
      }
      if (!fs.existsSync(`${baseImageFolder}diff`)) {
        fs.mkdirSync(`${baseImageFolder}diff`);
        console.log(chalk`Creating directory: {underline ${baseImageFolder}diff}\n`);
      }

      puppeteer.launch().then(async browser => {
        const page = await browser.newPage();

        await page.setViewport({
          width: fileData.config.viewport.width,
          height: fileData.config.viewport.height,
          isMobile: checkMobile,
          isLandscape: mobileLandscape
        });

        page.setCacheEnabled(fileData.config.enableCaching);

        await validatePage(browser, page, fileData.links, fileData.config.baseUrl, baseImageFolder);
      });
    });
  }, 500);
}