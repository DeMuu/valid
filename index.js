const fs = require('fs');
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

  // set a random spinner text from the `validatingSpinnerTitleList` array and display it
  loadingSpinner.setSpinnerTitle(validatingSpinnerTitleList[spinnerTitleIndex]);
  loadingSpinner.start();

  try {
    await pageObj.goto(`${baseUrl}${currLinkItem.path}`);

    // @TODO: add check if the directory used in 'path' exists and create it if not as puppeteer would throw an exception otherwise

    await pageObj.screenshot({path: `${baseImageFolder}${currLinkItem.path}.png`});
  }
  catch (exc) {
    loadingSpinner.stop(true);
    console.error(chalk.red.bold(exc));
  }

  loadingSpinner.stop(true);

  // @NOTE: this is just for testing purposes and should reflect actual results
  let testPassed = Math.round(Math.random()) === 1 ? true : false;

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
      console.log(chalk`{red.underline ${item.path}} did not match the expected image.`);
    });

    console.log('--------');
    console.log(chalk`${faultyLinksList.length} tests are {red.bold NOT OK}`);
  }
  else {
    console.log(chalk.bold.green('All tests passed! You are good to go'));
  }

  browserObj.close();
}

module.exports = (inputFile, checkMobile = false, mobileLandscape = false) => {
  if (!inputFile) {
    console.error(chalk.red('Parameter inputFile is mandatory. Please use the --help flag if you want documentation.'));
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
  
      loadingSpinner.stop(true);

      puppeteer.launch().then(async browser => {
        const page = await browser.newPage();

        await page.setViewport({
          width: 1280,
          height: 800,
          isMobile: checkMobile,
          isLandscape: mobileLandscape
        });

        await validatePage(browser, page, fileData.links, fileData.config.baseUrl, fileData.config.baseImageFolder);
      });
    });
  }, 500);
}