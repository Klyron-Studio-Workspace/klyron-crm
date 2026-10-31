-- AlterTable
ALTER TABLE `org_settings` ADD COLUMN `leadFormKey` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `org_settings_leadFormKey_key` ON `org_settings`(`leadFormKey`);
