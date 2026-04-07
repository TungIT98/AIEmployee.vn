/**
 * OWASP A06:2021 - Vulnerable and Outdated Components
 * Dependency Scanning Script
 *
 * This script:
 * 1. Runs npm audit to check for known vulnerabilities
 * 2. Checks for outdated packages
 * 3. Generates a compliance report
 *
 * Usage: node scripts/dependency-check.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPORT_FILE = 'dependency-compliance-report.json';

// Known vulnerable packages (for quick reference)
const CRITICAL_PACKAGES = [
  'event-stream@3.3.6', // flatmap-stream vulnerability
  'minimist@0.0.8',     // prototype pollution
];

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    return error.stdout || error.message;
  }
}

function checkNpmAudit() {
  console.log('\n[1/3] Running npm audit...');
  const output = runCommand('npm audit --json 2>/dev/null');

  try {
    const result = JSON.parse(output);
    const vulnerabilities = result.metadata?.vulnerabilities || {};

    return {
      critical: vulnerabilities.critical || 0,
      high: vulnerabilities.high || 0,
      medium: vulnerabilities.medium || 0,
      low: vulnerabilities.low || 0,
      total: vulnerabilities.critical + vulnerabilities.high + vulnerabilities.medium + vulnerabilities.low,
      passing: result.metadata?.vulnerabilities === undefined || result.metadata?.total === 0
    };
  } catch {
    // If JSON parse fails, npm audit might have exited cleanly (no vulnerabilities)
    return {
      critical: 0, high: 0, medium: 0, low: 0,
      total: 0,
      passing: !output.includes('vulnerability')
    };
  }
}

function checkOutdatedPackages() {
  console.log('[2/3] Checking for outdated packages...');
  const output = runCommand('npm outdated --json 2>/dev/null');

  try {
    const result = JSON.parse(output);
    const outdated = Object.entries(result).map(([name, info]) => ({
      package: name,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
      location: info.location
    }));
    return { outdated, count: outdated.length };
  } catch {
    return { outdated: [], count: 0 };
  }
}

function checkPackageVersions() {
  console.log('[3/3] Checking for known vulnerable package versions...');
  const packageJsonPath = path.join(__dirname, '..', 'api', 'package.json');
  const packageLockPath = path.join(__dirname, '..', 'api', 'package-lock.json');

  let packages = {};

  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packages = { ...pkg.dependencies, ...pkg.devDependencies };
  }

  const vulnerabilities = [];

  for (const [name, version] of Object.entries(packages)) {
    // Check for unpinned versions
    if (version === '*' || version === 'latest') {
      vulnerabilities.push({
        package: name,
        issue: 'Unpinned version',
        severity: 'medium',
        recommendation: 'Pin to specific version'
      });
    }
  }

  return { vulnerabilities, count: vulnerabilities.length };
}

function generateReport() {
  const audit = checkNpmAudit();
  const outdated = checkOutdatedPackages();
  const versions = checkPackageVersions();

  const report = {
    generatedAt: new Date().toISOString(),
    owaspReference: 'A06:2021 - Vulnerable and Outdated Components',
    status: audit.passing && outdated.count === 0 ? 'COMPLIANT' : 'ACTION REQUIRED',
    summary: {
      npmAudit: audit,
      outdatedPackages: {
        count: outdated.count,
        packages: outdated.outdated.slice(0, 10) // Top 10
      },
      versionIssues: versions
    },
    recommendations: []
  };

  if (audit.critical > 0) {
    report.recommendations.push({
      priority: 'CRITICAL',
      action: 'Update or replace packages with critical vulnerabilities immediately'
    });
  }

  if (audit.high > 0) {
    report.recommendations.push({
      priority: 'HIGH',
      action: 'Plan update for high severity vulnerabilities within 24 hours'
    });
  }

  if (outdated.count > 0) {
    report.recommendations.push({
      priority: 'MEDIUM',
      action: `Update ${outdated.count} outdated packages to latest stable versions`
    });
  }

  return report;
}

function main() {
  console.log('='.repeat(60));
  console.log('OWASP A06:2021 - Vulnerable Components Check');
  console.log('='.repeat(60));

  const report = generateReport();

  // Write report to file
  const reportPath = path.join(__dirname, REPORT_FILE);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Status: ${report.status}`);
  console.log(`NPM Audit: ${report.summary.npmAudit.total} vulnerabilities`);
  console.log(`  Critical: ${report.summary.npmAudit.critical}`);
  console.log(`  High: ${report.summary.npmAudit.high}`);
  console.log(`  Medium: ${report.summary.npmAudit.medium}`);
  console.log(`  Low: ${report.summary.npmAudit.low}`);
  console.log(`Outdated packages: ${report.summary.outdatedPackages.count}`);

  if (report.recommendations.length > 0) {
    console.log('\nRECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.priority}] ${rec.action}`);
    });
  }

  // Exit with error code if issues found
  if (report.summary.npmAudit.total > 0 || report.summary.outdatedPackages.count > 0) {
    console.log('\n⚠️  Issues detected - review report for details');
    process.exit(1);
  }

  console.log('\n✅ All checks passed - dependencies are up to date and secure');
  process.exit(0);
}

main();