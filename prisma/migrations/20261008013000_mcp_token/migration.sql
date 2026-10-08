-- AlterTable
ALTER TABLE `org_settings` ADD COLUMN `mcpTokenHash` CHAR(64) NULL,
    ADD COLUMN `mcpTokenCreatedAt` DATETIME(3) NULL;
