/* groovylint-disable DuplicateNumberLiteral, DuplicateStringLiteral, GStringExpressionWithinString, LineLength, NestedBlockDepth */
/* groovylint-disable-next-line CompileStatic */
DENO_IMAGE = 'denoland/deno:latest'
/* groovylint-disable-next-line GStringExpressionWithinString */
TOOLS_ARGS = '-e DENO_DIR=${WORKSPACE}/.deno --rm --volume /var/run/docker.sock:/var/run/docker.sock --volume /tmp:/tmp'
TOOLS_IMAGE = "${ECR}/develop/sts-tools:latest"

pipeline {
    agent none
    triggers {
        pollSCM('* * * * *')
    }

    options {
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
        parallelsAlwaysFailFast()
    }

    stages {
        stage('Checks') {
            parallel {
                stage('Lint & Format') {
                    agent {
                        docker {
                            image DENO_IMAGE
                            args TOOLS_ARGS
                            label 'small'
                        }
                    }
                    steps {
                        sh '''\
                          #!/bin/bash

                          deno lint src

                          deno fmt --check src test
                        '''.stripIndent()
                    }
                }

                stage('Test') {
                    agent {
                        docker {
                            image DENO_IMAGE
                            args TOOLS_ARGS
                            label 'large'
                        }
                    }
                    steps {
                        sh '''\
                          #!/bin/bash

                          deno test --coverage=.coverage --reporter junit --allow-read --allow-write test/* > .test.xml
                          deno coverage .coverage --lcov --output=.cov_profile.lcov
                        '''.stripIndent()
                    }
                    post {
                        always {
                            junit '.test.xml'
                            stash(name: 'coverage', includes: '.cov_profile.lcov')
                        }
                    }
                }
            }
        }

        stage('Coverage') {
            agent {
                docker {
                    image TOOLS_IMAGE
                    args TOOLS_ARGS
                    label 'small'
                }
            }

            steps {
                // Unstash the .cov_profile.lcov file stashed in the 'Test' stage
                unstash(name: 'coverage')

                sh '''\
                  #!/bin/bash

                  # Convert LCOV to Cobertura XML
                  lcov_cobertura --base-dir src --output coverage.xml .cov_profile.lcov
                '''.stripIndent()

                // Publish Cobertura report
                recordCoverage(
                  tools: [[parser: 'COBERTURA', pattern: 'coverage.xml']],
                  id: 'Cobertura',
                  name: 'Cobertura Coverage',
                  sourceCodeRetention: 'EVERY_BUILD',
                  qualityGates: [
                    [threshold: 60.0, metric: 'LINE', baseline: 'PROJECT', unstable: true],
                    [threshold: 60.0, metric: 'BRANCH', baseline: 'PROJECT', unstable: true]
                  ]
                )
            }
        }
    }
}
