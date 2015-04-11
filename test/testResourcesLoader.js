var testResourcesLoader = {
  load: function (file) {
    var testResources = require(file);

    testResources.commitArray = [];
    testResources.commitLookup = {};

    testResources.commits.forEach(function (testCommit) {
      testResources.commitArray.push(testCommit);
      testResources.commitLookup[testCommit.id] = testResources.commitArray.length - 1;
      testCommit.committed_date = new Date(testCommit.committed_date);
      testCommit.parents = function () {
        return testCommit.parentCommits;
      }
    });

    var names = Object.getOwnPropertyNames(testResources.testCases);
    for (var i = 0; i < names.length; i++) {
      var testCase = testResources.testCases[names[i]];
      testCase.hotspots.forEach(function (hotspot) {
        hotspot.firstCommit = new Date(hotspot.firstCommit);
        hotspot.lastCommit = new Date(hotspot.lastCommit);
      });

      if (testCase.options.hasOwnProperty('regexPattern')) {
        testCase.options.regex = new RegExp(testCase.options.regexPattern, testCase.options.regexOptions);
      }

    }

    return testResources;
  }
};

module.exports = testResourcesLoader;