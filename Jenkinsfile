pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 10, unit: 'MINUTES')
    }

    environment {
        PROJECT_NAME       = "web-scraper"
        TARGET_DIR         = "/var/jenkins_home/projects/${PROJECT_NAME}/${BRANCH_NAME}"
        SONAR_SCANNER_OPTS = "-Xmx512m"
        BACKEND_CONTAINER  = "${PROJECT_NAME}_${BRANCH_NAME}_backend"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('SonarQube Analysis') {
            when {
                branch 'develop'
            }
            steps {
                sh """
                    echo "Starting SonarQube analysis of $PROJECT_NAME"
                    echo "SONAR_SCANNER_OPTS=$SONAR_SCANNER_OPTS"
                    echo "NODE_OPTIONS=$NODE_OPTIONS"
                """
                script {
                    def scannerHome = tool 'sonar-scanner'
                    withSonarQubeEnv('SonarQube') {
                        sh """
                        ${scannerHome}/bin/sonar-scanner \
                          -Dsonar.projectKey=${PROJECT_NAME} \
                          -Dsonar.branch.name=${BRANCH_NAME}
                        """
                    }
                }
            }
        }
		
        stage('Deploy Frontend') {
            steps {
                sh """
                    echo "Deploying frontend to $TARGET_DIR"

                    mkdir -p "$TARGET_DIR"
                    rm -rf "$TARGET_DIR"/*

                    cp -r public/* "$TARGET_DIR"/
                """
            }
        }
        stage('Deploy Backend') {
            when {
                anyOf {
                    branch 'master'
                    branch 'develop'
                    branch 'feature-static-app'
                }
            }
            steps {
                sh """
                    docker build -t $BACKEND_CONTAINER .
                    
                    docker stop $BACKEND_CONTAINER || true
                    docker rm $BACKEND_CONTAINER || true

                    docker run -d \
                        --name $BACKEND_CONTAINER \
                        --network infra-net \
                        -e PORT=5000 \
                        $BACKEND_CONTAINER
                """
            }
        }
    }

    post {
        always {
            deleteDir()
        }
    }
}
