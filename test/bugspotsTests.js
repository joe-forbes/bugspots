'use strict';

//noinspection JSUnusedGlobalSymbols
var should = require('chai').should();
var proxyquire = require('proxyquire');

var testResources = require('../resources/test/bugspotsTestResources2.json');

testResources.commitSets.forEach(function (commitSet) {
  commitSet.forEach(function (testCommit) {
    testCommit.committed_date = new Date(testCommit.committed_date);
    testCommit.parents = function () {
      return testCommit.parentCommits;
    }
  });
});

testResources.hotspots.forEach(function (hotspot) {
  hotspot.firstCommit = new Date(hotspot.firstCommit);
  hotspot.lastCommit = new Date(hotspot.lastCommit);
});

testResources.options.regex = new RegExp(testResources.options.regexPattern, testResources.options.regexOptions);

var commitSetIndex = -1;

var giftStub = function () {
  return {
    branch: function (branch, headCommitHandler) {
      headCommitHandler(null, testResources.branch);
    },

    commits: function (commitId, depthToRetrieve, commitListHandler) {
      commitSetIndex++;
      commitListHandler(null, testResources.commitSets[commitSetIndex]);
    }
  }
};

//noinspection JSUnusedGlobalSymbols
var childProcessStub = {
  exec: function (cmd, opt, callback) {
    function go() {
      callback(null, testResources.diffCommands[cmd].replace(/\\n/g, '\n'));
    }
    setTimeout(go, 100);
  }
};

var Bugspots = proxyquire('../lib/bugspots', {
  'gift': giftStub,
   'child_process': childProcessStub
});

describe('bugspots tests', function () {

  it('should not blow up when you call it.', function (done) {
    var scanner = new Bugspots();

//    var options = testResources.options;

    var processResults = function (err, hotspots) {
      if (err) {
        throw err;
      }
      hotspots.should.eql(testResources.hotspots);
      done();
    };
    testResources.options.regex.should.eql(/\b(fix(es|ed)?|close(s|d)?)\b/i);
    scanner.scan(testResources.options, processResults);
  });

});
