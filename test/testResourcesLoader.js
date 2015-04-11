var testResourcesLoader = {
  load : function(file) {
    var testResources = require(file);

    testResources.commitArray = [];
    testResources.commitLookup = {};

    testResources.commits.forEach(function(testCommit){
      testResources.commitArray.push(testCommit);
      testResources.commitLookup[testCommit.id] = testResources.commitArray.length - 1;
      testCommit.committed_date = new Date(testCommit.committed_date);
      testCommit.parents = function () {
        return testCommit.parentCommits;
      }
    });
    testResources.hotspots.forEach(function (hotspot) {
      hotspot.firstCommit = new Date(hotspot.firstCommit);
      hotspot.lastCommit = new Date(hotspot.lastCommit);
    });

    testResources.options.regex = new RegExp(testResources.options.regexPattern, testResources.options.regexOptions);

    return testResources;
  }
};

module.exports = testResourcesLoader;