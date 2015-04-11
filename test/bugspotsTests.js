'use strict';

//noinspection JSUnusedGlobalSymbols
var should = require('chai').should();
var proxyquire = require('proxyquire');
var testResourcesLoader = require('./testResourcesLoader');

var testResources = testResourcesLoader.load('../resources/test/bugspotsTestResources2.json');

//require('../util/logger').addTarget({targetType: 'console'});

var giftStub = function () {
  return {
    branch: function (branch, headCommitHandler) {
      headCommitHandler(null, testResources.branch);
    },

    commits: function (commitId, depthToRetrieve, skip, commitListHandler) {
      var commitIndex = testResources.commitLookup[commitId] + skip;
      var commitSet = testResources.commitArray.slice(commitIndex, commitIndex + depthToRetrieve);
      commitListHandler(null, commitSet);
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
