-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `title` VARCHAR(120) NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'CLIENT') NOT NULL DEFAULT 'MEMBER',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `passwordHash` VARCHAR(255) NOT NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `user_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `session_tokenHash_key`(`tokenHash`),
    INDEX `session_userId_revokedAt_idx`(`userId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_token` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_token_tokenHash_key`(`tokenHash`),
    INDEX `password_reset_token_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempt` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `success` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempt_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `login_attempt_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permission` (
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'CLIENT') NOT NULL,
    `module` VARCHAR(40) NOT NULL,
    `access` ENUM('NONE', 'READ', 'WRITE') NOT NULL,

    PRIMARY KEY (`role`, `module`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event` (
    `id` VARCHAR(191) NOT NULL,
    `actorType` ENUM('USER', 'AGENT', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(120) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` VARCHAR(40) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_createdAt_idx`(`createdAt`),
    INDEX `event_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `event_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `event_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `org_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'org',
    `name` VARCHAR(120) NOT NULL DEFAULT 'Klyron Studio',
    `website` VARCHAR(255) NULL,
    `billingEmail` VARCHAR(254) NULL,
    `defaultCurrency` CHAR(3) NOT NULL DEFAULT 'USD',
    `membersSeeAssignedOnly` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pipeline_stage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `kind` ENUM('OPEN', 'WON', 'LOST') NOT NULL DEFAULT 'OPEN',
    `tone` ENUM('NEUTRAL', 'INFO', 'WARNING', 'BRAND', 'SUCCESS') NOT NULL DEFAULT 'NEUTRAL',
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pipeline_stage_position_idx`(`position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `company` VARCHAR(120) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `website` VARCHAR(255) NULL,
    `source` ENUM('LEADFORGE', 'REFERRAL', 'INBOUND', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `stageId` VARCHAR(191) NOT NULL,
    `position` DOUBLE NOT NULL DEFAULT 0,
    `ownerId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `lostReason` VARCHAR(40) NULL,
    `lostDetail` VARCHAR(500) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_stageId_position_idx`(`stageId`, `position`),
    INDEX `lead_ownerId_idx`(`ownerId`),
    INDEX `lead_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_service` (
    `leadId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`leadId`, `serviceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_note` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `type` ENUM('NOTE', 'CALL', 'MEETING', 'EMAIL') NOT NULL DEFAULT 'NOTE',
    `body` TEXT NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `authorName` VARCHAR(120) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_note_leadId_occurredAt_idx`(`leadId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminder` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `note` VARCHAR(255) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reminder_assigneeId_completedAt_dueAt_idx`(`assigneeId`, `completedAt`, `dueAt`),
    INDEX `reminder_leadId_completedAt_idx`(`leadId`, `completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `contactName` VARCHAR(120) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `website` VARCHAR(255) NULL,
    `leadId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_leadId_key`(`leadId`),
    INDEX `client_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_token` ADD CONSTRAINT `password_reset_token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `pipeline_stage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_service` ADD CONSTRAINT `lead_service_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_service` ADD CONSTRAINT `lead_service_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_note` ADD CONSTRAINT `lead_note_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_note` ADD CONSTRAINT `lead_note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder` ADD CONSTRAINT `reminder_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder` ADD CONSTRAINT `reminder_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminder` ADD CONSTRAINT `reminder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client` ADD CONSTRAINT `client_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client` ADD CONSTRAINT `client_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
