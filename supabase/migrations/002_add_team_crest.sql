-- Adicionar coluna team_crest na tabela standings
ALTER TABLE standings 
ADD COLUMN team_crest TEXT;

-- Comentário: Esta coluna armazenará a URL do escudo do time
-- Será preenchida pelo dailySync com o valor team.crest da API football-data.org