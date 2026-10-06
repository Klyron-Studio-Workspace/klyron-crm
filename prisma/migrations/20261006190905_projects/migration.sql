-- AlterTable
ALTER TABLE `client` ADD COLUMN `notes` TEXT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `clientId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNING',
    `clientId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `startDate` DATE NULL,
    `dueDate` DATE NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_clientId_idx`(`clientId`),
    INDEX `project_status_idx`(`status`),
    INDEX `project_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_member` (
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_member_userId_idx`(`userId`),
    PRIMARY KEY (`projectId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `milestone` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `dueDate` DATE NULL,
    `completedAt` DATETIME(3) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `milestone_projectId_position_idx`(`projectId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('TODO', 'DOING', 'DONE') NOT NULL DEFAULT 'TODO',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `assigneeId` VARCHAR(191) NULL,
    `milestoneId` VARCHAR(191) NULL,
    `dueDate` DATE NULL,
    `position` DOUBLE NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `task_projectId_status_position_idx`(`projectId`, `status`, `position`),
    INDEX `task_assigneeId_status_idx`(`assigneeId`, `status`),
    INDEX `task_milestoneId_idx`(`milestoneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `user_clientId_idx` ON `user`(`clientId`);

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_member` ADD CONSTRAINT `project_member_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_member` ADD CONSTRAINT `project_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `milestone` ADD CONSTRAINT `milestone_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `milestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
