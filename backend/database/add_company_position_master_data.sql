/*
 * ============================================================
 * WELLJOB HRIS
 * Client Company and Company Position Master Data
 * ============================================================
 *
 * Purpose:
 * - Remove hard-coded company choices from operational forms.
 * - Provide centralized client-company configuration.
 * - Provide company-specific deployment-position choices.
 * - Preserve existing deployment/company/position history.
 *
 * Important:
 * Existing string fields such as:
 *
 *   deployment_assignments.company
 *   deployment_assignments.position
 *   employees.company
 *   incidents.company
 *   users.assigned_company
 *
 * remain intact.
 *
 * These master tables become the authoritative source for
 * future selectable companies and positions, while existing
 * strings continue serving as historical/current snapshots.
 *
 * Records are deactivated instead of hard-deleted.
 * ============================================================
 */

CREATE TABLE IF NOT EXISTS client_companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  company_name VARCHAR(255) NOT NULL,

  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_client_companies_company_name (
    company_name
  ),

  KEY idx_client_companies_active_name (
    is_active,
    company_name
  )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/*
 * ============================================================
 * COMPANY POSITIONS
 * ============================================================
 *
 * position_name intentionally matches:
 *
 *   deployment_assignments.position VARCHAR(150)
 *
 * This prevents configuration from accepting a position value
 * that the deployment table cannot safely store.
 * ============================================================
 */

CREATE TABLE IF NOT EXISTS company_positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  company_id BIGINT UNSIGNED NOT NULL,

  position_name VARCHAR(150) NOT NULL,

  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_company_positions_company_position (
    company_id,
    position_name
  ),

  KEY idx_company_positions_company_active_name (
    company_id,
    is_active,
    position_name
  ),

  CONSTRAINT fk_company_positions_company
    FOREIGN KEY (company_id)
    REFERENCES client_companies (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


/*
 * ============================================================
 * BACKFILL EXISTING CLIENT COMPANIES
 * ============================================================
 *
 * Existing company names are collected from:
 *
 * - deployment assignments
 * - employee records
 * - incident snapshots
 * - HR Coordinator assignments
 *
 * Source values are:
 *
 * - trimmed
 * - converted to utf8mb4
 * - compared using utf8mb4_unicode_ci
 *
 * This protects the migration from legacy source tables that
 * may use different character sets or collations.
 *
 * Duplicate master records are avoided explicitly instead of
 * using INSERT IGNORE so unrelated SQL/data errors are not
 * silently suppressed.
 * ============================================================
 */

INSERT INTO client_companies (
  company_name
)
SELECT
  source.company_name
FROM (
  SELECT
    CONVERT(
      TRIM(company)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS company_name
  FROM deployment_assignments
  WHERE company IS NOT NULL
    AND TRIM(company) <> ''

  UNION

  SELECT
    CONVERT(
      TRIM(company)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS company_name
  FROM employees
  WHERE company IS NOT NULL
    AND TRIM(company) <> ''

  UNION

  SELECT
    CONVERT(
      TRIM(company)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS company_name
  FROM incidents
  WHERE company IS NOT NULL
    AND TRIM(company) <> ''

  UNION

  SELECT
    CONVERT(
      TRIM(assigned_company)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS company_name
  FROM users
  WHERE assigned_company IS NOT NULL
    AND TRIM(assigned_company) <> ''
) AS source

WHERE source.company_name IS NOT NULL
  AND source.company_name <> ''

  AND NOT EXISTS (
    SELECT
      1
    FROM client_companies AS existing_company
    WHERE existing_company.company_name =
      source.company_name
  );


/*
 * ============================================================
 * BACKFILL EXISTING DEPLOYMENT POSITIONS
 * ============================================================
 *
 * Position choices are company-specific.
 *
 * Existing deployment assignments remain untouched.
 * Their stored company and position values remain historical
 * snapshots even if the master option is later deactivated.
 *
 * Source company and position values are converted to the same
 * character set/collation used by the master tables before
 * matching and inserting.
 *
 * Duplicate position records are avoided explicitly rather
 * than using INSERT IGNORE.
 * ============================================================
 */

INSERT INTO company_positions (
  company_id,
  position_name
)
SELECT DISTINCT
  company_master.id,
  existing_positions.position_name

FROM (
  SELECT
    CONVERT(
      TRIM(company)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS company_name,

    CONVERT(
      TRIM(position)
      USING utf8mb4
    ) COLLATE utf8mb4_unicode_ci
      AS position_name

  FROM deployment_assignments

  WHERE company IS NOT NULL
    AND TRIM(company) <> ''

    AND position IS NOT NULL
    AND TRIM(position) <> ''
) AS existing_positions

INNER JOIN client_companies AS company_master
  ON company_master.company_name =
    existing_positions.company_name

WHERE existing_positions.position_name IS NOT NULL
  AND existing_positions.position_name <> ''

  AND NOT EXISTS (
    SELECT
      1

    FROM company_positions AS existing_position

    WHERE existing_position.company_id =
      company_master.id

      AND existing_position.position_name =
        existing_positions.position_name
  );