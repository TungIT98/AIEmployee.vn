/**
 * Restoration Test Script - COM-132
 * Monthly restoration testing for 3-2-1 backup strategy
 *
 * Run: node src/services/restorationTest.js
 */

const BackupService = require('./backup');

class RestorationTest {
  constructor() {
    this.backupService = new BackupService();
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  /**
   * Log test result
   */
  logTest(name, passed, details = {}) {
    this.testResults.tests.push({
      name,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
    this.testResults.summary.total++;
    if (passed) {
      this.testResults.summary.passed++;
    } else {
      this.testResults.summary.failed++;
    }

    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${status}: ${name}`);
    if (details.error) {
      console.log(`    Error: ${details.error}`);
    }
    if (details.message) {
      console.log(`    ${details.message}`);
    }
  }

  /**
   * Test 1: Check for available backups
   */
  async testBackupAvailability() {
    console.log('\n[Test 1] Checking for available backups...');

    try {
      const backups = this.backupService.getBackups({ status: 'completed', limit: 10 });

      if (backups.total === 0) {
        this.logTest('Backup availability', false, {
          error: 'No completed backups found'
        });
        return false;
      }

      this.logTest('Backup availability', true, {
        message: `Found ${backups.total} completed backup(s)`,
        totalBackups: backups.total
      });

      // Store latest backup for subsequent tests
      this.testResults.latestBackup = backups.backups[0];
      return true;
    } catch (error) {
      this.logTest('Backup availability', false, { error: error.message });
      return false;
    }
  }

  /**
   * Test 2: Verify backup integrity
   */
  async testBackupIntegrity() {
    console.log('\n[Test 2] Verifying backup integrity...');

    if (!this.testResults.latestBackup) {
      this.logTest('Backup integrity', false, {
        error: 'No backup to verify (previous test failed)'
      });
      return false;
    }

    try {
      const backupId = this.testResults.latestBackup.id;
      const verification = this.backupService.verifyBackup(backupId);

      const isValid = verification.status === 'verified';

      this.logTest('Backup integrity', isValid, {
        backupId,
        status: verification.status,
        checksumValid: verification.checksumValid,
        locations: verification.locations,
        errors: verification.errors
      });

      this.testResults.verification = verification;
      return isValid;
    } catch (error) {
      this.logTest('Backup integrity', false, { error: error.message });
      return false;
    }
  }

  /**
   * Test 3: Perform restoration
   */
  async testRestoration() {
    console.log('\n[Test 3] Performing restoration test...');

    if (!this.testResults.latestBackup) {
      this.logTest('Restoration', false, {
        error: 'No backup to restore (previous test failed)'
      });
      return false;
    }

    try {
      const backupId = this.testResults.latestBackup.id;
      const result = this.backupService.restore(backupId);

      if (!result.success) {
        this.logTest('Restoration', false, { error: 'Restoration returned failure' });
        return false;
      }

      // Validate restored data structure
      const data = result.data;
      const isValid = data && typeof data === 'object';

      this.logTest('Restoration', isValid, {
        backupId,
        source: result.source,
        dataKeys: data ? Object.keys(data) : [],
        hasTimestamp: !!(data && data.timestamp)
      });

      this.testResults.restoreResult = result;
      return isValid;
    } catch (error) {
      this.logTest('Restoration', false, { error: error.message });
      return false;
    }
  }

  /**
   * Test 4: Validate 3-2-1 strategy implementation
   */
  async test321Strategy() {
    console.log('\n[Test 4] Validating 3-2-1 strategy...');

    if (!this.testResults.latestBackup) {
      this.logTest('3-2-1 strategy (locations)', false, {
        error: 'No backup to validate (previous test failed)'
      });
      return false;
    }

    const locations = this.testResults.latestBackup.location;
    const primary = !!locations.primary;
    const secondary = !!locations.secondary;
    const offsite = !!locations.offsite;

    const locationsValid = primary && secondary;

    this.logTest('3-2-1 strategy (primary)', primary, {
      message: primary ? 'Primary location configured' : 'Primary location missing'
    });

    this.logTest('3-2-1 strategy (secondary)', secondary, {
      message: secondary ? 'Secondary location configured' : 'Secondary location missing'
    });

    this.logTest('3-2-1 strategy (offsite)', offsite, {
      message: offsite ? 'Offsite location configured' : 'Offsite location missing (warning)'
    });

    this.testResults.locations = { primary, secondary, offsite };
    return locationsValid;
  }

  /**
   * Test 5: Validate retention policy
   */
  async testRetentionPolicy() {
    console.log('\n[Test 5] Validating retention policy...');

    try {
      const stats = this.backupService.getStatistics();

      // Check retention settings
      const config = this.backupService.getConfig();
      const retention = config.retention;

      const hasRetention =
        retention.daily > 0 &&
        retention.weekly > 0 &&
        retention.monthly > 0;

      this.logTest('Retention policy configured', hasRetention, {
        retention: retention
      });

      return hasRetention;
    } catch (error) {
      this.logTest('Retention policy', false, { error: error.message });
      return false;
    }
  }

  /**
   * Test 6: Validate backup schedule
   */
  async testBackupSchedule() {
    console.log('\n[Test 6] Validating backup schedule...');

    try {
      const schedule = this.backupService.getSchedule();

      const hasSchedule =
        schedule.daily &&
        schedule.weekly &&
        schedule.monthly;

      this.logTest('Backup schedule configured', hasSchedule, {
        schedule: schedule
      });

      return hasSchedule;
    } catch (error) {
      this.logTest('Backup schedule', false, { error: error.message });
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('='.repeat(60));
    console.log('RESTORATION TEST SUITE - COM-132');
    console.log('Date:', this.testResults.timestamp);
    console.log('='.repeat(60));

    // Run tests in sequence
    await this.testBackupAvailability();
    await this.testBackupIntegrity();
    await this.testRestoration();
    await this.test321Strategy();
    await this.testRetentionPolicy();
    await this.testBackupSchedule();

    // Print summary
    this.printSummary();

    return this.testResults;
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testResults.summary.total}`);
    console.log(`Passed: ${this.testResults.summary.passed}`);
    console.log(`Failed: ${this.testResults.summary.failed}`);
    console.log(`Success Rate: ${((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (this.testResults.summary.failed === 0) {
      console.log('\n✓ ALL TESTS PASSED - Backup system operational\n');
    } else {
      console.log('\n✗ SOME TESTS FAILED - Review backup system\n');
    }
  }

  /**
   * Save test results to file
   */
  saveResults() {
    const fs = require('fs');
    const path = require('path');

    const resultsPath = path.join(
      this.backupService.config.localPath,
      'test-results',
      `restoration-test-${new Date().toISOString().slice(0, 10)}.json`
    );

    try {
      const dir = path.dirname(resultsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resultsPath, JSON.stringify(this.testResults, null, 2));
      console.log(`\nTest results saved to: ${resultsPath}`);
    } catch (error) {
      console.error(`\nFailed to save test results: ${error.message}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new RestorationTest();

  tester.runAllTests()
    .then((results) => {
      tester.saveResults();
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = RestorationTest;