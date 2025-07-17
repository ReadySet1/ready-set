#!/usr/bin/env node

/**
 * Ready Set LLC Load Testing Suite
 * 
 * This script runs comprehensive load tests against the production application
 * to validate performance and scalability requirements.
 * 
 * Usage:
 *   node scripts/load-test.js [environment] [test-type]
 * 
 * Examples:
 *   node scripts/load-test.js staging smoke
 *   node scripts/load-test.js production full
 *   node scripts/load-test.js localhost api-only
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const ENVIRONMENTS = {
    localhost: 'http://localhost:3000',
    staging: 'https://development.readysetllc.com',
    production: 'https://readysetllc.com'
};

const TEST_TYPES = {
    smoke: 'Basic smoke test with minimal load',
    api: 'API-focused load testing',
    full: 'Comprehensive load testing with all scenarios',
    stress: 'Stress testing with high load'
};

// Command line arguments
const environment = process.argv[2] || 'localhost';
const testType = process.argv[3] || 'smoke';

if (!ENVIRONMENTS[environment]) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`Valid environments: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    process.exit(1);
}

if (!TEST_TYPES[testType]) {
    console.error(`❌ Invalid test type: ${testType}`);
    console.error(`Valid test types: ${Object.keys(TEST_TYPES).join(', ')}`);
    process.exit(1);
}

const baseUrl = ENVIRONMENTS[environment];

// Artillery configuration generator
function generateArtilleryConfig(type) {
    const baseConfig = {
        config: {
            target: baseUrl,
            plugins: {
                'artillery-plugin-metrics-by-endpoint': {}
            },
            phases: [],
            defaults: {
                headers: {
                    'User-Agent': 'Artillery Load Test'
                }
            },
            processor: './scripts/load-test-processor.js'
        },
        scenarios: []
    };

    // Configure phases based on test type
    switch (type) {
        case 'smoke':
            baseConfig.config.phases = [
                { duration: 30, arrivalRate: 2, name: 'Warm up' },
                { duration: 60, arrivalRate: 5, name: 'Sustained load' }
            ];
            break;
        
        case 'api':
            baseConfig.config.phases = [
                { duration: 60, arrivalRate: 10, name: 'API warm up' },
                { duration: 300, arrivalRate: 20, name: 'API sustained load' },
                { duration: 60, arrivalRate: 5, name: 'Cool down' }
            ];
            break;
        
        case 'full':
            baseConfig.config.phases = [
                { duration: 120, arrivalRate: 5, name: 'Warm up' },
                { duration: 300, arrivalRate: 15, name: 'Ramp up' },
                { duration: 600, arrivalRate: 25, name: 'Sustained load' },
                { duration: 300, arrivalRate: 10, name: 'Ramp down' },
                { duration: 120, arrivalRate: 2, name: 'Cool down' }
            ];
            break;
        
        case 'stress':
            baseConfig.config.phases = [
                { duration: 60, arrivalRate: 10, name: 'Warm up' },
                { duration: 120, arrivalRate: 50, name: 'Stress ramp' },
                { duration: 300, arrivalRate: 100, name: 'Peak stress' },
                { duration: 180, arrivalRate: 25, name: 'Recovery' }
            ];
            break;
    }

    // Add scenarios
    baseConfig.scenarios = [
        // Health check scenario
        {
            name: 'Health Check',
            weight: 20,
            flow: [
                {
                    get: {
                        url: '/api/health',
                        expect: [
                            { statusCode: 200 },
                            { hasProperty: 'status' }
                        ]
                    }
                }
            ]
        },

        // Homepage scenario
        {
            name: 'Homepage Load',
            weight: 15,
            flow: [
                {
                    get: {
                        url: '/',
                        expect: [
                            { statusCode: 200 },
                            { contentType: 'text/html' }
                        ]
                    }
                }
            ]
        },

        // API Authentication scenario
        {
            name: 'API Authentication',
            weight: 10,
            flow: [
                {
                    post: {
                        url: '/api/auth/signin',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: {
                            email: 'test@example.com',
                            password: 'testpassword'
                        },
                        expect: [
                            { statusCode: [200, 401] }  // 401 is expected for test credentials
                        ]
                    }
                }
            ]
        },

        // Catering request scenario
        {
            name: 'Catering Request Form',
            weight: 20,
            flow: [
                {
                    get: {
                        url: '/catering-request',
                        expect: [
                            { statusCode: 200 }
                        ]
                    }
                },
                {
                    post: {
                        url: '/api/catering/quote',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: {
                            pickupAddress: '123 Test St, San Francisco, CA',
                            deliveryAddress: '456 Test Ave, San Francisco, CA',
                            orderValue: 150,
                            deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                            orderType: 'catering',
                            items: [
                                { name: 'Test Item', quantity: 1, price: 150 }
                            ]
                        },
                        expect: [
                            { statusCode: [200, 400, 422] }  // Various responses are acceptable
                        ]
                    }
                }
            ]
        },

        // Order tracking scenario
        {
            name: 'Order Tracking',
            weight: 15,
            flow: [
                {
                    get: {
                        url: '/tracking/test-order-123',
                        expect: [
                            { statusCode: [200, 404] }  // Order might not exist
                        ]
                    }
                }
            ]
        },

        // Static assets scenario
        {
            name: 'Static Assets',
            weight: 10,
            flow: [
                {
                    get: {
                        url: '/images/logo/full-logo-light.png',
                        expect: [
                            { statusCode: 200 }
                        ]
                    }
                },
                {
                    get: {
                        url: '/favicon.ico',
                        expect: [
                            { statusCode: 200 }
                        ]
                    }
                }
            ]
        },

        // Contact form scenario
        {
            name: 'Contact Form',
            weight: 10,
            flow: [
                {
                    get: {
                        url: '/contact',
                        expect: [
                            { statusCode: 200 }
                        ]
                    }
                },
                {
                    post: {
                        url: '/api/contact',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: {
                            name: 'Load Test User',
                            email: 'loadtest@example.com',
                            message: 'This is a load test message',
                            subject: 'Load Testing'
                        },
                        expect: [
                            { statusCode: [200, 400, 422] }
                        ]
                    }
                }
            ]
        }
    ];

    return baseConfig;
}

// Create load test processor
function createProcessor() {
    const processorContent = `
module.exports = {
    // Custom functions for load testing
    setRandomDelay: (context, events, done) => {
        // Add random delay between 100ms and 2s to simulate real user behavior
        const delay = Math.floor(Math.random() * 1900) + 100;
        setTimeout(done, delay);
    },

    logCustomMetric: (context, events, done) => {
        // Log custom metrics
        events.emit('counter', 'custom.requests.total', 1);
        done();
    },

    beforeRequest: (requestParams, context, events, done) => {
        // Add request timestamp
        context.vars.requestStartTime = Date.now();
        done();
    },

    afterResponse: (requestParams, response, context, events, done) => {
        // Calculate custom response time
        if (context.vars.requestStartTime) {
            const responseTime = Date.now() - context.vars.requestStartTime;
            events.emit('histogram', 'custom.response_time', responseTime);
        }
        
        // Log slow responses
        if (response.statusCode >= 400) {
            events.emit('counter', 'custom.errors.total', 1);
        }
        
        done();
    }
};
`;

    fs.writeFileSync(path.join(__dirname, 'load-test-processor.js'), processorContent);
}

// Run Artillery test
function runLoadTest(config) {
    return new Promise((resolve, reject) => {
        const configFile = path.join(__dirname, `load-test-${testType}-${Date.now()}.yml`);
        const reportFile = path.join(__dirname, `load-test-report-${testType}-${Date.now()}.json`);
        
        // Write config to file
        const yaml = require('js-yaml');
        fs.writeFileSync(configFile, yaml.dump(config));
        
        console.log(`🚀 Starting ${testType} load test against ${environment} environment`);
        console.log(`📊 Target: ${baseUrl}`);
        console.log(`📝 Config: ${configFile}`);
        console.log(`📈 Report: ${reportFile}`);
        console.log('');

        const artilleryArgs = [
            'run',
            '--config', configFile,
            '--output', reportFile
        ];

        const artillery = spawn('npx', ['artillery', ...artilleryArgs], {
            stdio: 'inherit',
            shell: true
        });

        artillery.on('close', (code) => {
            // Generate HTML report
            const htmlReport = reportFile.replace('.json', '.html');
            const reportCmd = spawn('npx', ['artillery', 'report', '--output', htmlReport, reportFile], {
                stdio: 'inherit',
                shell: true
            });

            reportCmd.on('close', () => {
                // Cleanup
                fs.unlinkSync(configFile);
                if (fs.existsSync(path.join(__dirname, 'load-test-processor.js'))) {
                    fs.unlinkSync(path.join(__dirname, 'load-test-processor.js'));
                }

                if (code === 0) {
                    console.log('');
                    console.log('✅ Load test completed successfully');
                    console.log(`📊 HTML Report: ${htmlReport}`);
                    console.log(`📋 JSON Report: ${reportFile}`);
                    resolve({ code, reportFile, htmlReport });
                } else {
                    console.log('');
                    console.log('❌ Load test failed');
                    reject(new Error(`Artillery exited with code ${code}`));
                }
            });
        });

        artillery.on('error', (error) => {
            console.error('❌ Failed to start Artillery:', error);
            reject(error);
        });
    });
}

// Analyze test results
function analyzeResults(reportFile) {
    try {
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        const aggregate = report.aggregate;

        console.log('\n📊 Load Test Results Summary:');
        console.log('=====================================');
        console.log(`🎯 Total Requests: ${aggregate.counters['http.requests'] || 0}`);
        console.log(`✅ Successful Requests: ${aggregate.counters['http.responses'] || 0}`);
        console.log(`❌ Failed Requests: ${(aggregate.counters['http.requests'] || 0) - (aggregate.counters['http.responses'] || 0)}`);
        console.log(`🕐 Average Response Time: ${Math.round(aggregate.latency?.mean || 0)}ms`);
        console.log(`🔥 95th Percentile: ${Math.round(aggregate.latency?.p95 || 0)}ms`);
        console.log(`⚡ 99th Percentile: ${Math.round(aggregate.latency?.p99 || 0)}ms`);
        console.log(`📈 Requests/second: ${Math.round(aggregate.rates?.arrivalRate || 0)}`);

        // Performance thresholds
        const thresholds = {
            avgResponseTime: 2000,  // 2 seconds
            p95ResponseTime: 5000,  // 5 seconds
            errorRate: 5           // 5%
        };

        const avgResponseTime = aggregate.latency?.mean || 0;
        const p95ResponseTime = aggregate.latency?.p95 || 0;
        const errorRate = ((aggregate.counters['http.requests'] || 0) - (aggregate.counters['http.responses'] || 0)) / (aggregate.counters['http.requests'] || 1) * 100;

        console.log('\n🎯 Performance Analysis:');
        console.log('========================');
        console.log(`Average Response Time: ${avgResponseTime < thresholds.avgResponseTime ? '✅' : '❌'} ${Math.round(avgResponseTime)}ms (threshold: ${thresholds.avgResponseTime}ms)`);
        console.log(`95th Percentile: ${p95ResponseTime < thresholds.p95ResponseTime ? '✅' : '❌'} ${Math.round(p95ResponseTime)}ms (threshold: ${thresholds.p95ResponseTime}ms)`);
        console.log(`Error Rate: ${errorRate < thresholds.errorRate ? '✅' : '❌'} ${Math.round(errorRate * 100) / 100}% (threshold: ${thresholds.errorRate}%)`);

        const allPassed = avgResponseTime < thresholds.avgResponseTime && 
                         p95ResponseTime < thresholds.p95ResponseTime && 
                         errorRate < thresholds.errorRate;

        console.log(`\n🏆 Overall Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

        return allPassed;
    } catch (error) {
        console.error('❌ Failed to analyze results:', error);
        return false;
    }
}

// Main execution
async function main() {
    try {
        // Check if Artillery is installed
        try {
            await spawn('npx', ['artillery', '--version'], { stdio: 'pipe' });
        } catch (error) {
            console.error('❌ Artillery not found. Installing...');
            await spawn('npm', ['install', '-g', 'artillery'], { stdio: 'inherit' });
        }

        // Create processor file
        createProcessor();

        // Generate configuration
        const config = generateArtilleryConfig(testType);

        // Run load test
        const { reportFile } = await runLoadTest(config);

        // Analyze results
        const testPassed = analyzeResults(reportFile);

        // Exit with appropriate code
        process.exit(testPassed ? 0 : 1);

    } catch (error) {
        console.error('❌ Load test execution failed:', error);
        process.exit(1);
    }
}

// Show help
function showHelp() {
    console.log('Ready Set LLC Load Testing Suite');
    console.log('=================================');
    console.log('');
    console.log('Usage: node scripts/load-test.js [environment] [test-type]');
    console.log('');
    console.log('Environments:');
    Object.entries(ENVIRONMENTS).forEach(([env, url]) => {
        console.log(`  ${env.padEnd(12)} - ${url}`);
    });
    console.log('');
    console.log('Test Types:');
    Object.entries(TEST_TYPES).forEach(([type, description]) => {
        console.log(`  ${type.padEnd(12)} - ${description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/load-test.js staging smoke');
    console.log('  node scripts/load-test.js production full');
    console.log('  node scripts/load-test.js localhost api');
    console.log('');
}

// Handle help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Install dependencies if needed
if (!fs.existsSync(path.join(__dirname, '../node_modules/js-yaml'))) {
    console.log('📦 Installing required dependencies...');
    const install = spawn('npm', ['install', 'js-yaml'], { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..') 
    });
    
    install.on('close', () => {
        main();
    });
} else {
    main();
} 