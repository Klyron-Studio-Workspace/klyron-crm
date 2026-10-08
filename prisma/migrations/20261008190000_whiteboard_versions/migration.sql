ALTER TABLE `whiteboard` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `whiteboard_version` (
    `id` VARCHAR(191) NOT NULL,
    `boardId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `content` JSON NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `whiteboard_version_boardId_revision_key`(`boardId`, `revision`),
    INDEX `whiteboard_version_boardId_createdAt_idx`(`boardId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whiteboard_version` ADD CONSTRAINT `whiteboard_version_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `whiteboard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `whiteboard_version` ADD CONSTRAINT `whiteboard_version_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
