-- Require new member accounts to verify their email before their first login.
-- Existing accounts remain verified.
ALTER TABLE `users`
  ADD COLUMN `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `verification_token` VARCHAR(255) NULL,
  ADD COLUMN `verification_token_expires_at` DATETIME NULL,
  ADD COLUMN `verification_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `verification_resend_after` DATETIME NULL;
