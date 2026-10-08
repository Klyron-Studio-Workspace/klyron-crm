ALTER TABLE `whiteboard` ADD COLUMN `favorite` BOOLEAN NOT NULL DEFAULT false, ADD COLUMN `lastOpenedAt` DATETIME(3) NULL;

CREATE TABLE `whiteboard_member` (
    `boardId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `access` ENUM('NONE', 'READ', 'WRITE') NOT NULL DEFAULT 'READ',
    INDEX `whiteboard_member_userId_idx`(`userId`),
    PRIMARY KEY (`boardId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whiteboard_comment` (
    `id` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `whiteboard_comment_boardId_createdAt_idx`(`boardId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whiteboard_member` ADD CONSTRAINT `whiteboard_member_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `whiteboard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `whiteboard_member` ADD CONSTRAINT `whiteboard_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `whiteboard_comment` ADD CONSTRAINT `whiteboard_comment_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `whiteboard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `whiteboard_comment` ADD CONSTRAINT `whiteboard_comment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
