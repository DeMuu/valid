# valid
VALID - VisuAL Image Diff --- visual regression testing with ease

Note that this project is **WIP** and not yet reliable for use in actual testing. Proposals and PRs are welcome! :D

## Installation
Note that **node version 7.10.1 or newer is required** to use valid.

`node install -g valid`
or
`yarn global add valid`

## Usage
1. Setup your config JSON file if you haven't (see example config below)
2. Run `valid config.json`
  a. Optionally you can set --checkMobile and --mobileLandscape parameters which are false by default. It is suggested that you use different config files if you want to run tests for desktop and mobile viewports.

### Proposed Flow
1. Pass in an array of links/routes to visit.
2. The lib will then loop through these, visit each link and take a screenshot.
3. Screenshots are saved in an "expected" and "tmp" folder.
4. The generated diff image will use a naming pattern "output_[i].png" where [i] equals the current iteration index.
5. An image-diff lib will then be used to detect visual changes.
6. If a difference is found the link will be added to a "faulty" array.
7. If no difference is found the "output_[i].png" will be deleted.
8. *[OPTIONAL]* After each passed iteration the taken screenshot from "tmp" will be moved to replace the old one in "expected". This might also be configurable on a per-item basis.
9. After the loop finishes an object will be returned with the following design
   ```js
   {
     didPass: BOOLEAN,
     faultyPages: [{
       url: 'LINK',
       image: '[PATH TO DIFF IMG]',
       ...
     }]
   }
   ```

**Notes on implementation**

The input data should be passable as JSON file or a JSON compliant object. This could look like the following:
```js
[{
 url: 'https://www.example.com/about',
 image: './regression-testing/expected/about.png',
 didChange: false
}]
```
The `didChange` property implies that there should be no difference between the captured and expected image. If a difference is found it will be treated as an error case.
If this is on the other hand set to `true`, we expect a difference and won't treat this as an error. The captured image will then (if point 8 in the **Propose Flow** list above is implemented) replace the one in the expected folder
