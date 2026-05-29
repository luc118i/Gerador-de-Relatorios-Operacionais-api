-- Esquemas de rota (linhas planejadas)
CREATE TABLE route_schemes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid REFERENCES trips(id) ON DELETE SET NULL,
  nome_linha  text NOT NULL,
  horario     time,
  sentido     text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Pontos de cada esquema (sequência planejada)
CREATE TABLE route_scheme_points (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id           uuid NOT NULL REFERENCES route_schemes(id) ON DELETE CASCADE,
  ordem               int NOT NULL,
  local_id            int REFERENCES locais(id) ON DELETE SET NULL,
  nome_ponto          text NOT NULL,
  tipo                text,
  horario_comercial   time,
  tempo_local_min     int,
  tipo_trecho         text,
  UNIQUE (scheme_id, ordem)
);

-- Velocidades esperadas por tipo de via por esquema
CREATE TABLE route_speed_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id   uuid NOT NULL REFERENCES route_schemes(id) ON DELETE CASCADE,
  tipo_via    text NOT NULL CHECK (tipo_via IN ('BR', 'Est', 'Mun', 'Urb')),
  vel_kmh     int NOT NULL,
  UNIQUE (scheme_id, tipo_via)
);

-- Cache de distâncias entre pares de pontos
CREATE TABLE route_distances_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_a_id  int REFERENCES locais(id) ON DELETE CASCADE,
  local_b_id  int REFERENCES locais(id) ON DELETE CASCADE,
  dist_km     numeric(10, 3) NOT NULL,
  tipo_via    text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (local_a_id, local_b_id)
);

-- Índices de performance
CREATE INDEX idx_route_schemes_active     ON route_schemes(active);
CREATE INDEX idx_route_schemes_trip       ON route_schemes(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_scheme_points_scheme     ON route_scheme_points(scheme_id, ordem);
CREATE INDEX idx_route_speed_scheme       ON route_speed_config(scheme_id);
CREATE INDEX idx_distances_cache_pair     ON route_distances_cache(local_a_id, local_b_id);
