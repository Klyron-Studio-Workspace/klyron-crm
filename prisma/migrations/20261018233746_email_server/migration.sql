-- CreateTable
CREATE TABLE `mailbox` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `address` VARCHAR(254) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mailbox_userId_key`(`userId`),
    UNIQUE INDEX `mailbox_address_key`(`address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_thread` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `linkedLeadId` VARCHAR(191) NULL,
    `linkedClientId` VARCHAR(191) NULL,
    `lastEmailAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_thread_linkedLeadId_idx`(`linkedLeadId`),
    INDEX `email_thread_linkedClientId_idx`(`linkedClientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(512) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `mailboxId` VARCHAR(191) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `folder` ENUM('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'ARCHIVE') NOT NULL DEFAULT 'INBOX',
    `fromAddress` VARCHAR(254) NOT NULL,
    `fromName` VARCHAR(120) NULL,
    `toAddresses` JSON NOT NULL,
    `ccAddresses` JSON NOT NULL,
    `bccAddresses` JSON NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `bodyHtml` LONGTEXT NULL,
    `bodyText` LONGTEXT NULL,
    `inReplyToId` VARCHAR(191) NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_messageId_key`(`messageId`),
    INDEX `email_mailboxId_folder_receivedAt_idx`(`mailboxId`, `folder`, `receivedAt`),
    INDEX `email_threadId_receivedAt_idx`(`threadId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_attachment` (
    `id` VARCHAR(191) NOT NULL,
    `emailId` VARCHAR(191) NOT NULL,
    `storedFileId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(127) NOT NULL,
    `size` BIGINT NOT NULL,

    INDEX `email_attachment_emailId_idx`(`emailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mailbox` ADD CONSTRAINT `mailbox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_thread` ADD CONSTRAINT `email_thread_linkedLeadId_fkey` FOREIGN KEY (`linkedLeadId`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_thread` ADD CONSTRAINT `email_thread_linkedClientId_fkey` FOREIGN KEY (`linkedClientId`) REFERENCES `client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email` ADD CONSTRAINT `email_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `email_thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email` ADD CONSTRAINT `email_mailboxId_fkey` FOREIGN KEY (`mailboxId`) REFERENCES `mailbox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email` ADD CONSTRAINT `email_inReplyToId_fkey` FOREIGN KEY (`inReplyToId`) REFERENCES `email`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachment` ADD CONSTRAINT `email_attachment_emailId_fkey` FOREIGN KEY (`emailId`) REFERENCES `email`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachment` ADD CONSTRAINT `email_attachment_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `stored_file`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
