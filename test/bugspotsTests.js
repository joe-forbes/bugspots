'use strict';

//noinspection JSUnusedGlobalSymbols
var should = require('chai').should();
var proxyquire = require('proxyquire');
var testResourcesLoader = require('./testResourcesLoader');
var testResources = {};

var logger = require('../util/logger');
//logger.addTarget({targetType: 'console'});

var giftStub = function () {
  return {
    _getCommitIndex: function (commitId) {
      if (!testResources.commitLookup.hasOwnProperty(commitId)) {
        commitId = testResources.commitAliases[commitId];
      }
      var commitIndex = testResources.commitLookup[commitId];
      return commitIndex;
    },
    commits: function (commitId, depthToRetrieve, skip, commitListHandler) {
      var startIndex = this._getCommitIndex(commitId) + skip;
      var commitSet = testResources.commitArray.slice(startIndex, startIndex + depthToRetrieve);
      commitListHandler(null, commitSet);
    }
  }
};

//noinspection JSUnusedGlobalSymbols
var childProcessStub = {
  exec: function (cmd, opt, callback) {
    function go() {
      if (!testResources.diffCommands.hasOwnProperty(cmd)) {
        logger.warn('Results not found for cmd: ' + cmd);
      }
      callback(null, testResources.diffCommands[cmd].replace(/\\n/g, '\n'));
    }
    setTimeout(go, 100);
  }
};

var Bugspots = proxyquire('../lib/bugspots', {
  'gift': giftStub,
   'child_process': childProcessStub
});

describe('Bugspots basic tests', function () {

  beforeEach(function(){
    testResources = testResourcesLoader.load('../resources/test/bugspotsTestResources.json');
  });

  it('should look for "master" if no "branch" option supplied.', function (done) {
    var testCaseName = 'defaultBranchTest';

    logger.info(testCaseName);
    delete testResources.testCases[testCaseName].options.branch;
    var scanner = new Bugspots();

    var processResults = function (err, hotspots) {
      if (err) {
        throw err;
      }
      hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
      done();
    };
    scanner.scan(testResources.testCases[testCaseName].options, processResults);
  });

  it('should work for at least one configuration.', function (done) {
    var testCaseName = 'basicTest';
    logger.info(testCaseName);
    var scanner = new Bugspots();

    var processResults = function (err, hotspots) {
      if (err) {
        throw err;
      }
      hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
      done();
    };
    scanner.scan(testResources.testCases[testCaseName].options, processResults);
  });

});
