-- AlterTable
ALTER TABLE `org_settings` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `autoPaymentReminders` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `defaultTaxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `invoicePrefix` VARCHAR(10) NOT NULL DEFAULT 'INV',
    ADD COLUMN `invoiceSeq` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `paymentInstructions` TEXT NULL,
    ADD COLUMN `paymentTermsDays` INTEGER NOT NULL DEFAULT 14,
    ADD COLUMN `proposalPrefix` VARCHAR(10) NOT NULL DEFAULT 'PRO',
    ADD COLUMN `proposalSeq` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `price` DECIMAL(12, 2) NULL,
    ADD COLUMN `priceUnit` ENUM('FIXED', 'HOURLY', 'DAILY', 'MONTHLY') NOT NULL DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE `proposal` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'DRAFT',
    `clientId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `currency` CHAR(3) NOT NULL,
    `issueDate` DATE NOT NULL,
    `validUntil` DATE NULL,
    `introduction` TEXT NULL,
    `terms` TEXT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `publicToken` VARCHAR(64) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `responseNote` VARCHAR(1000) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proposal_number_key`(`number`),
    UNIQUE INDEX `proposal_publicToken_key`(`publicToken`),
    INDEX `proposal_status_idx`(`status`),
    INDEX `proposal_clientId_idx`(`clientId`),
    INDEX `proposal_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_item` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `position` INTEGER NOT NULL,

    INDEX `proposal_item_proposalId_position_idx`(`proposalId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `proposalId` VARCHAR(191) NULL,
    `currency` CHAR(3) NOT NULL,
    `issueDate` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `notes` TEXT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `amountPaid` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `publicToken` VARCHAR(64) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `voidedAt` DATETIME(3) NULL,
    `lastReminderAt` DATETIME(3) NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoice_number_key`(`number`),
    UNIQUE INDEX `invoice_publicToken_key`(`publicToken`),
    INDEX `invoice_status_dueDate_idx`(`status`, `dueDate`),
    INDEX `invoice_clientId_idx`(`clientId`),
    INDEX `invoice_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_item` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `position` INTEGER NOT NULL,

    INDEX `invoice_item_invoiceId_position_idx`(`invoiceId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paidOn` DATE NOT NULL,
    `method` ENUM('BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE', 'ONLINE', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `reference` VARCHAR(120) NULL,
    `note` VARCHAR(500) NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_invoiceId_idx`(`invoiceId`),
    INDEX `payment_paidOn_idx`(`paidOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense` (
    `id` VARCHAR(191) NOT NULL,
    `spentOn` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `category` ENUM('SOFTWARE', 'HARDWARE', 'CONTRACTORS', 'MARKETING', 'OFFICE', 'TRAVEL', 'TAXES_FEES', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `vendor` VARCHAR(120) NULL,
    `description` VARCHAR(500) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expense_spentOn_idx`(`spentOn`),
    INDEX `expense_clientId_idx`(`clientId`),
    INDEX `expense_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proposal` ADD CONSTRAINT `proposal_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal` ADD CONSTRAINT `proposal_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal` ADD CONSTRAINT `proposal_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_item` ADD CONSTRAINT `proposal_item_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `proposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_item` ADD CONSTRAINT `proposal_item_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `proposal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_item` ADD CONSTRAINT `invoice_item_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_item` ADD CONSTRAINT `invoice_item_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
