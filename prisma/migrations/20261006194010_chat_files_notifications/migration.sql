-- AlterTable
ALTER TABLE `reminder` ADD COLUMN `notifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `channel` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('TEAM', 'CLIENT', 'DIRECT') NOT NULL,
    `name` VARCHAR(80) NULL,
    `clientId` VARCHAR(191) NULL,
    `directKey` VARCHAR(255) NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `channel_clientId_key`(`clientId`),
    UNIQUE INDEX `channel_directKey_key`(`directKey`),
    INDEX `channel_kind_lastMessageAt_idx`(`kind`, `lastMessageAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channel_member` (
    `channelId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `channel_member_userId_idx`(`userId`),
    PRIMARY KEY (`channelId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `authorName` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_channelId_createdAt_idx`(`channelId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stored_file` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(120) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `size` BIGINT NOT NULL,
    `kind` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER') NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `hasThumbnail` BOOLEAN NOT NULL DEFAULT false,
    `uploadedById` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `channelId` VARCHAR(191) NULL,
    `messageId` VARCHAR(191) NULL,
    `sharedWithClient` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stored_file_storageKey_key`(`storageKey`),
    INDEX `stored_file_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `stored_file_projectId_idx`(`projectId`),
    INDEX `stored_file_channelId_idx`(`channelId`),
    INDEX `stored_file_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` VARCHAR(500) NULL,
    `link` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `emailedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `reminder_completedAt_notifiedAt_dueAt_idx` ON `reminder`(`completedAt`, `notifiedAt`, `dueAt`);

-- AddForeignKey
ALTER TABLE `channel` ADD CONSTRAINT `channel_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channel_member` ADD CONSTRAINT `channel_member_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channel_member` ADD CONSTRAINT `channel_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_file` ADD CONSTRAINT `stored_file_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_file` ADD CONSTRAINT `stored_file_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_file` ADD CONSTRAINT `stored_file_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_file` ADD CONSTRAINT `stored_file_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_file` ADD CONSTRAINT `stored_file_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
