'use strict';

var git = require('gift');
var exec = require('child_process').exec;
var logger = require('../util/logger');

try {
  logger.addTarget({
    targetType: 'file', targetConfig: {
      level: 'info',
      filename: './logs/bugspots.log',
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false
    }
  });
} catch (e) {
  logger.debug('error adding file logging target. already added?');
}

function Bugspots() {
  this.hotspots = {}
}

function Fix(message, date, files) {
  this.message = message;
  this.date = date;
  this.files = files
}

function HotSpots(opts) {
  this.file = opts.file;
  this.score = opts.score;
  this.fixCommits = opts.fixCommits;
  this.firstCommit = opts.firstCommit;
  this.lastCommit = opts.lastCommit;
}

Bugspots.prototype.scan = function (opts, callback, commitInclusionDecisionHandler) {

  var _regex = /\b(fix(es|ed)?|close(s|d)?)\b/i;

  var repo = git(opts.repo)
    , segmentHeadCommitIdentifier = opts.segmentHeadCommitIdentifier || 'master'
    , depthRemaining = opts.depth || 500
    , regex = opts.regex || _regex
    , useRelativeDates = opts.useRelativeDates || false
    , batchSize = opts.batchSize || 500
    , self = this
    , fixes = []
    , commitCache = []
    , batchesReceived = 0
    , segmentTailCommitIdentifier = opts.segmentTailCommitIdentifier || '';

  var defaultCommitInclusionDecisionHandler = function (commit) {
    var message = commit.message.split('\n')[0];
    logger.debug('testing commmit.message: ' + message);
    return regex.test(commit.message);
  };

  var shouldIncludeCommit = commitInclusionDecisionHandler || defaultCommitInclusionDecisionHandler;

  // this callback will be called when all of the commits have been retrieved
  var sendOutput = function () {

    var commitsToProcess = commitCache.length;

    var finishCommit = function () {
      commitsToProcess -= 1;
      if (0 === commitsToProcess) {
        formatFixes();
      }
    };

    commitCache.forEach(function (commit) {

      var execFn = function (err, stdout) {
        logger.debug('diff command output: ' + stdout);
        if (err) {
          return callback(err)
        }
        var files = stdout.split("\n").slice(0, -1);
        fixes.push(new Fix(commit.message, commit.committed_date, files));
        finishCommit();
      };

      if (shouldIncludeCommit(commit)) {
        var cmd, opt;
        cmd = 'git diff ' + commit.id + '..' + commit.parents()[0].id + ' --name-only';
        opt = {cwd: commit.repo.path};
        logger.debug('preparing to issue command: ' + cmd);
        //asynchronously call diff command
        exec(cmd, opt, execFn);
      }
      else {
        setTimeout(finishCommit, 1);
      }
    });
  };

  // this callback will be called when all of the commits have been processed.
  var formatFixes = function () {
    logger.debug('entered sendOutput function. fixes.length: ' + fixes.length);
    if (fixes.length > 0) {
      fixes.sort(function (a, b) {
        return a.date - b.date
      });
      var endDate = useRelativeDates ? Date.parse(fixes[fixes.length - 1].date) + 1 : Date.parse(new Date().toUTCString());
      var oldestUTC = Date.parse(fixes[0].date);
      logger.debug('endDate: ' + endDate);
      logger.debug('oldestUTC: ' + oldestUTC);
      fixes.forEach(function fixesLoop(fix) {
        fix.files.forEach(function fixLoop(file) {
          var fixUTC = Date.parse(fix.date)
            , t = 1 - ((endDate - fixUTC) / (endDate - oldestUTC));
          if (!self.hotspots[file]) {
            self.hotspots[file] = {score: 0, fixCommits: 0, firstCommit: fix.date};
          }
          logger.debug('fileHit: ' + file);
          self.hotspots[file].score += 1 / (1 + Math.exp((-12 * t) + 12));
          self.hotspots[file].fixCommits++;
          self.hotspots[file].lastCommit = fix.date;
        })
      });
    }
    return callback(null,
      Object.keys(self.hotspots)
        .sort(function sortFn(a, b) {
          if (self.hotspots[a].score < self.hotspots[b].score) return 1;
          if (self.hotspots[b].score < self.hotspots[a].score) return -1;
          if (self.hotspots[a].file < self.hotspots[b].file) return 1;
          if (self.hotspots[b].file < self.hotspots[a].file) return -1;
          return 0;
        })
        .map(function mapFn(file) {
          return new HotSpots({
            file: file,
            score: self.hotspots[file].score,
            fixCommits: self.hotspots[file].fixCommits,
            firstCommit: self.hotspots[file].firstCommit,
            lastCommit: self.hotspots[file].lastCommit
          })
        })
    )
  };

  var retrieveCommits = function () {
    var depthToRetrieve = depthRemaining < batchSize ? depthRemaining : batchSize;
    logger.debug('depthRemaining: ' + depthRemaining + '. getting ' + depthToRetrieve + ' more commits: ' + JSON.stringify({
      commitId: segmentHeadCommitIdentifier,
      depthToRetrieve: depthToRetrieve,
      skip: batchesReceived * batchSize
    }));
    repo.commits(segmentHeadCommitIdentifier, depthToRetrieve, batchesReceived * batchSize, commitListHandler)
  };

  var commitListHandler = function (err, commitList) {
    if (err) return callback(err);

    batchesReceived++;

    if (commitList.length < 1) {
      logger.debug('bottom of commit history reached.');
      sendOutput();
    }

    var commitsInProgress = commitList.length
      , segmentTailCommitFound = false;

    logger.debug('commitsInProgress:' + commitsInProgress);
    commitList.some(function (commit) {
      if (segmentTailCommitIdentifier === commit.id) {
        segmentTailCommitFound = true;
        return true;
      }
      commitCache.push(commit);
    });

    var keepGoing = true;
    if (segmentTailCommitFound) {
      keepGoing = false;
    }

    depthRemaining = depthRemaining - commitList.length;
    logger.debug('depthRemaining:' + depthRemaining);

    if (0 >= depthRemaining) {
      keepGoing = false;
      if (0 > depthRemaining) {
        logger.warn("invalid depthRemaining: " + depthRemaining);
      } else {
        logger.debug('requested depth achieved.');
      }
    }
    if (!keepGoing) {
      sendOutput();
    } else {
      retrieveCommits();
    }

  };
  logger.debug('depthRemaining:' + depthRemaining);
  retrieveCommits();
};

module.exports = Bugspots;