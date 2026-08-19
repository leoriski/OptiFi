-- A dica do dia deixou de ser um cartão na Home e passou a ser uma notificação
-- no telemóvel. A preferência vivia em localStorage — o servidor não a consegue
-- ler, por isso tem de estar na base para o cron a respeitar.
ALTER TABLE profiles ADD COLUMN daily_tips boolean NOT NULL DEFAULT true;

-- Sem isto, uma dica reenviada num retry do cron chegava duas vezes ao telemóvel.
CREATE TABLE daily_tip_sends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  PRIMARY KEY (user_id, sent_on)
);
ALTER TABLE daily_tip_sends ENABLE ROW LEVEL SECURITY;
