const fs = require('fs');
const path = require('path');

const structure = {
  "11-avatar-crm": {
    files: ["README.md", ".gitignore", "package.json", "firebase.json", "wrangler.toml", ".env.example", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md"],
    dirs: {
      "docs": { files: ["PRD.md", "architecture.md", "api-spec.md", "database-schema.md", "deployment-guide.md", "user-guide.md", "developer-guide.md", "enterprise-architecture.md", "testing-strategy.md"] },
      "public": {
        files: ["index.html", "dashboard.html", "login.html", "register.html", "404.html", "manifest.json", "sw.js"],
        dirs: { "assets": { dirs: { "images": {}, "icons": {}, "fonts": {}, "videos": {} } }, "locales": { files: ["en.json", "hi.json", "ta.json"] } }
      },
      "src": {
        dirs: {
          "layers": {
            dirs: {
              "presentation": { files: ["components.js", "pages.js", "layouts.js"] },
              "application": { files: ["leadUseCases.js", "customerUseCases.js", "dealUseCases.js", "taskUseCases.js", "invoiceUseCases.js"] },
              "domain": { files: ["leadEntity.js", "customerEntity.js", "dealEntity.js", "taskEntity.js", "invoiceEntity.js"] },
              "data": {
                dirs: {
                  "repositories": { files: ["leadRepository.js", "customerRepository.js", "dealRepository.js", "taskRepository.js", "invoiceRepository.js"] },
                  "queries": { files: ["leadQueries.js", "customerQueries.js", "analyticsQueries.js"] },
                  "cache": { files: ["cacheManager.js", "cacheStrategy.js", "cacheInvalidation.js"] },
                  "indexes": { files: ["leadIndexes.js", "customerIndexes.js", "analyticsIndexes.js"] },
                  "migrations": { files: ["migration_001.js", "migration_002.js"] }
                }
              },
              "infrastructure": {
                dirs: {
                  "firebase": { files: ["firebaseClient.js", "firebaseAdmin.js"] },
                  "cloudflare": { files: ["cloudflareWorker.js", "cloudflareR2.js"] },
                  "ai": { files: ["providerManager.js", "groqProvider.js", "geminiProvider.js", "openaiProvider.js", "fallbackProvider.js"] },
                  "whatsapp": { files: ["whatsappClient.js", "whatsappWebhook.js"] },
                  "payments": { files: ["razorpayClient.js", "phonepeClient.js", "paytmClient.js"] }
                }
              }
            }
          },
          "modules": {
            dirs: {
              "crm": { files: ["module.js", "leadManager.js", "customerManager.js", "dealManager.js", "pipelineManager.js", "quotationManager.js"] },
              "communications": { files: ["module.js", "whatsappService.js", "emailService.js", "smsService.js", "templates.js", "omnichannelInbox.js"] },
              "finance": { files: ["module.js", "invoiceGenerator.js", "gstCalculator.js", "subscriptionManager.js", "billingEngine.js", "paymentGateway.js"] },
              "automation": { files: ["module.js", "workflowBuilder.js", "workflowEngine.js", "triggers.js", "actions.js"] },
              "ai": { files: ["module.js", "aiService.js", "copilot.js", "embeddings.js", "vectorStore.js"] },
              "fieldforce": { files: ["module.js", "tracking.js", "attendance.js", "visits.js", "geofencing.js"] },
              "enterprise": { files: ["module.js", "ticketManager.js", "slaManager.js", "amcManager.js", "serviceRequest.js"] },
              "admin": { files: ["module.js", "tenantManager.js", "userManager.js", "roleManager.js", "billingManager.js"] }
            }
          },
          "core": {
            dirs: {
              "events": { files: ["eventBus.js", "publishers.js", "subscribers.js", "queue.js", "deadLetterQueue.js"] },
              "jobs": { files: ["jobQueue.js", "workers.js", "retries.js", "scheduler.js", "deadJobs.js"] },
              "multitenancy": { files: ["tenantResolver.js", "tenantContext.js", "tenantMiddleware.js", "tenantLimits.js", "tenantBilling.js", "tenantIsolation.js"] },
              "rbac": { files: ["roleEngine.js", "permissionEngine.js", "fieldLevelSecurity.js", "recordLevelSecurity.js", "hierarchyPermissions.js"] },
              "audit": { files: ["auditLogger.js", "changeTracker.js", "entityHistory.js", "rollback.js", "snapshots.js"] },
              "analytics": { files: ["aggregations.js", "metrics.js", "funnels.js", "cohorts.js", "attribution.js"] },
              "saas": { files: ["plans.js", "entitlements.js", "featureFlags.js", "metering.js", "addons.js"] },
              "integrations": { files: ["integrationHub.js", "webhookManager.js", "metaIntegration.js", "googleIntegration.js", "tallyIntegration.js"] },
              "backup": { files: ["backupManager.js", "autoBackup.js", "weeklyBackup.js", "monthlyBackup.js", "manualBackup.js", "restoreManager.js"] },
              "monitoring": { files: ["logger.js", "metricsCollector.js", "errorTracker.js", "performanceTracker.js", "alertManager.js"] },
              "security": { files: ["secretsManager.js", "keyRotation.js", "encryptionService.js", "tokenManager.js"] },
              "notifications": { files: ["notificationEngine.js", "emailNotifier.js", "smsNotifier.js", "pushNotifier.js", "whatsappNotifier.js", "notificationTemplates.js"] },
              "search": { files: ["searchEngine.js", "indexing.js", "ranking.js", "filters.js", "savedSearches.js", "recentSearches.js"] },
              "importExport": { files: ["importManager.js", "exportManager.js", "leadImport.js", "customerImport.js", "productImport.js", "excelExport.js", "csvExport.js", "pdfExport.js"] },
              "roadmap": { files: ["roadmapManager.js", "plannedFeatures.js", "inProgressFeatures.js", "completedFeatures.js", "bugTracker.js", "feedbackManager.js", "releaseManager.js"] }
            }
          },
          "api": {
            dirs: {
              "contracts": { files: ["leadContracts.js", "customerContracts.js", "dealContracts.js", "invoiceContracts.js"] },
              "controllers": { files: ["leadController.js", "customerController.js", "dealController.js", "invoiceController.js"] },
              "middleware": { files: ["authMiddleware.js", "tenantMiddleware.js", "rbacMiddleware.js", "validationMiddleware.js"] },
              "validators": { files: ["leadValidator.js", "customerValidator.js", "invoiceValidator.js"] }
            }
          },
          "css": {
            files: ["style.css", "dashboard.css", "components.css", "responsive.css"],
            dirs: { "themes": { files: ["light.css", "dark.css"] } }
          },
          "js": {
            files: ["app.js", "config.js", "router.js", "i18n.js", "state.js"],
            dirs: {
              "components": { files: ["Sidebar.js", "Header.js", "Modal.js", "Table.js", "Cards.js", "Charts.js", "Forms.js", "Kanban.js", "Calendar.js"] },
              "utils": { files: ["helpers.js", "validators.js", "formatters.js", "constants.js", "encryption.js"] }
            }
          },
          "pages": { files: ["dashboard.html", "leads.html", "customers.html", "sales.html", "tasks.html", "whatsapp.html", "inbox.html", "reports.html", "settings.html", "admin.html", "roadmap.html"] }
        }
      },
      "tests": {
        dirs: {
          "unit": { files: ["leadManager.test.js", "customerManager.test.js", "dealManager.test.js", "eventBus.test.js", "rbacEngine.test.js"] },
          "integration": { files: ["leadPipeline.test.js", "whatsappFlow.test.js", "invoiceGeneration.test.js"] },
          "e2e": { files: ["loginFlow.test.js", "leadToDeal.test.js", "fullSalesCycle.test.js"] },
          "performance": { files: ["loadTesting.js", "stressTesting.js"] },
          "security": { files: ["authSecurity.test.js", "tenantIsolation.test.js"] }
        }
      },
      "functions": {
        files: ["index.js"],
        dirs: {
          "api": { files: ["leads.js", "customers.js", "whatsapp.js", "invoices.js", "reports.js"] },
          "triggers": { files: ["leadCreated.js", "leadUpdated.js", "taskDue.js", "whatsappReceived.js"] },
          "schedules": { files: ["dailyBackup.js", "weeklyBackup.js", "monthlyBackup.js", "dailyReport.js", "reminders.js"] }
        }
      },
      "database": {
        dirs: {
          "firestore": { files: ["collections.js", "indexes.js", "seeds.js"], dirs: { "migrations": { files: ["migration_001.js", "migration_002.js"] } } },
          "cloudflare": { files: ["schema.sql"], dirs: { "migrations": {} } }
        }
      },
      "config": { files: ["firebase.js", "cloudflare.js", "groq.js", "whatsapp.js", "razorpay.js", "backup.js", "email.js", "monitoring.js"] }
    }
  }
};

function createStructure(basePath, item) {
  if (item.files) item.files.forEach(file => fs.writeFileSync(path.join(basePath, file), '', 'utf8'));
  if (item.dirs) Object.entries(item.dirs).forEach(([dirName, content]) => {
    const dirPath = path.join(basePath, dirName);
    fs.mkdirSync(dirPath, { recursive: true });
    createStructure(dirPath, content);
  });
}

const root = "11-avatar-crm";
fs.mkdirSync(root, { recursive: true });
createStructure(root, structure[root]);
console.log("✅ All folders and empty files created successfully.");