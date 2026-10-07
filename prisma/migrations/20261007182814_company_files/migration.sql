-- AlterTable
ALTER TABLE `stored_file` ADD COLUMN `company` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `folder` VARCHAR(80) NULL,
    ADD COLUMN `restricted` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `stored_file_company_folder_idx` ON `stored_file`(`company`, `folder`);
