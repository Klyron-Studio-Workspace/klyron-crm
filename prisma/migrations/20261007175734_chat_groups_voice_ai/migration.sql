-- AlterTable
ALTER TABLE `channel` ADD COLUMN `createdById` VARCHAR(191) NULL,
    MODIFY `kind` ENUM('TEAM', 'CLIENT', 'DIRECT', 'GROUP') NOT NULL;

-- AlterTable
ALTER TABLE `message` ADD COLUMN `fromAi` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stored_file` ADD COLUMN `durationMs` INTEGER NULL,
    ADD COLUMN `voiceNote` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `waveform` JSON NULL;

-- AddForeignKey
ALTER TABLE `channel` ADD CONSTRAINT `channel_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
