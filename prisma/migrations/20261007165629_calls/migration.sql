-- AlterTable
ALTER TABLE `message` ADD COLUMN `callId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `call` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `roomName` VARCHAR(64) NOT NULL,
    `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    `startedById` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `notesStatus` ENUM('NONE', 'PENDING', 'READY', 'FAILED') NOT NULL DEFAULT 'NONE',
    `summary` TEXT NULL,
    `decisions` JSON NULL,
    `actionItems` JSON NULL,
    `notesModel` VARCHAR(80) NULL,
    `notesError` VARCHAR(500) NULL,
    `notesAt` DATETIME(3) NULL,

    UNIQUE INDEX `call_roomName_key`(`roomName`),
    INDEX `call_channelId_startedAt_idx`(`channelId`, `startedAt`),
    INDEX `call_status_startedAt_idx`(`status`, `startedAt`),
    INDEX `call_notesStatus_idx`(`notesStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_participant` (
    `callId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    INDEX `call_participant_userId_idx`(`userId`),
    PRIMARY KEY (`callId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transcript_segment` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `speakerName` VARCHAR(120) NOT NULL,
    `text` TEXT NOT NULL,
    `spokenAt` DATETIME(3) NOT NULL,

    INDEX `transcript_segment_callId_spokenAt_idx`(`callId`, `spokenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `call`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call` ADD CONSTRAINT `call_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call` ADD CONSTRAINT `call_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_participant` ADD CONSTRAINT `call_participant_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_participant` ADD CONSTRAINT `call_participant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transcript_segment` ADD CONSTRAINT `transcript_segment_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transcript_segment` ADD CONSTRAINT `transcript_segment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
