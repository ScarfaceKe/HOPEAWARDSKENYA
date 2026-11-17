-- Hope Awards Kenya — database verification.
--
-- Run this against BOTH databases and diff the output:
--
--   psql "$DATABASE_URL"        -f scripts/db-verify.sql > source.txt
--   psql "$TARGET_DATABASE_URL" -f scripts/db-verify.sql > target.txt
--   diff source.txt target.txt   # must be empty
--
-- It is read-only. Section 6 prints a hash, never a value: whatsapp_auth holds
-- the linked WhatsApp session credentials.
--
-- Takes: row counts, vote totals and the ledger, payment references, sequence
-- positions, and the index set. Run it only when no votes are landing (freeze
-- writes), otherwise the two outputs differ by the traffic in between.

\set ON_ERROR_STOP on

\echo '== 1. row counts per table =='
SELECT 'admin_audit_log' AS table_name, count(*) AS rows FROM admin_audit_log
UNION ALL SELECT 'artists', count(*) FROM artists
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'manual_vote_settings', count(*) FROM manual_vote_settings
UNION ALL SELECT 'nominee_notifications', count(*) FROM nominee_notifications
UNION ALL SELECT 'pending_payments', count(*) FROM pending_payments
UNION ALL SELECT 'requests', count(*) FROM requests
UNION ALL SELECT 'social_automation', count(*) FROM social_automation
UNION ALL SELECT 'social_posts', count(*) FROM social_posts
UNION ALL SELECT 'uploaded_images', count(*) FROM uploaded_images
UNION ALL SELECT 'votes', count(*) FROM votes
UNION ALL SELECT 'whatsapp_auth', count(*) FROM whatsapp_auth
UNION ALL SELECT 'whatsapp_automation', count(*) FROM whatsapp_automation
ORDER BY table_name;

\echo '== 2. vote totals per nominee (ranking tally vs paid ledger) =='
-- `difference` is expected to be non-zero on nominees an admin adjusted by hand
-- (that path adds ranking votes without a payment); it must be IDENTICAL on both
-- databases.
SELECT a.id,
       a.name,
       a.category,
       a.total_votes                                   AS ranking_tally,
       COALESCE(SUM(v.votes_added), 0)::bigint         AS paid_ledger_votes,
       COALESCE(SUM(v.amount_kes), 0)::bigint          AS paid_ledger_kes,
       a.total_votes - COALESCE(SUM(v.votes_added), 0) AS difference
FROM artists a
LEFT JOIN votes v ON v.artist_id = a.id
GROUP BY a.id, a.name, a.category, a.total_votes
ORDER BY a.id;

\echo '== 3. paid aggregate (the public total must match too) =='
SELECT count(*)                                   AS paid_rows,
       COALESCE(SUM(votes_added), 0)::bigint      AS paid_votes,
       COALESCE(SUM(amount_kes), 0)::bigint       AS revenue_kes
FROM votes;

\echo '== 4. payment references =='
SELECT count(*)                                                    AS vote_rows,
       count(DISTINCT payment_reference)                           AS distinct_references,
       count(*) FILTER (WHERE gateway_request_id IS NOT NULL)      AS with_gateway_id,
       count(*) FILTER (WHERE gateway_request_id IS NULL)          AS without_gateway_id
FROM votes;

-- Both must return zero rows. A duplicate reference is a double-credit waiting
-- to happen; the unique index should already make it impossible.
SELECT 'duplicate vote reference' AS problem, payment_reference, count(*)
FROM votes GROUP BY payment_reference HAVING count(*) > 1
UNION ALL
SELECT 'duplicate pending reference', reference, count(*)
FROM pending_payments GROUP BY reference HAVING count(*) > 1;

\echo '== 5. pending payments still open =='
SELECT reference,
       artist_id,
       votes_added,
       amount_kes,
       gateway_request_id IS NOT NULL AS has_gateway_id,
       created_at
FROM pending_payments
ORDER BY created_at;

-- Zero rows expected: an order that already has a vote must have been cleared.
SELECT 'pending order already credited' AS problem, p.reference
FROM pending_payments p
JOIN votes v ON v.payment_reference = p.reference;

\echo '== 6. content checksums (must be identical on both databases) =='
SELECT 'artists' AS table_name,
       md5(string_agg(id::text || '|' || total_votes::text || '|' || category, ',' ORDER BY id)) AS checksum
FROM artists
UNION ALL
SELECT 'categories',
       md5(string_agg(id || '|' || name || '|' || group_name || '|' || display_order::text, ',' ORDER BY id))
FROM categories
UNION ALL
SELECT 'votes',
       md5(string_agg(id::text || '|' || payment_reference || '|' || votes_added::text || '|' ||
                      amount_kes::text || '|' || coalesce(gateway_request_id, ''), ',' ORDER BY id))
FROM votes
UNION ALL
SELECT 'pending_payments',
       md5(string_agg(reference || '|' || votes_added::text || '|' || amount_kes::text || '|' ||
                      coalesce(gateway_request_id, ''), ',' ORDER BY reference))
FROM pending_payments
UNION ALL
SELECT 'requests',
       md5(string_agg(id::text || '|' || status || '|' || category, ',' ORDER BY id))
FROM requests
UNION ALL
SELECT 'admin_audit_log',
       md5(string_agg(id::text || '|' || action || '|' || entity, ',' ORDER BY id))
FROM admin_audit_log
UNION ALL
SELECT 'nominee_notifications',
       md5(string_agg(id::text || '|' || status || '|' || phone, ',' ORDER BY id))
FROM nominee_notifications
UNION ALL
-- Hash of the hashes: the image payloads themselves are never printed.
SELECT 'uploaded_images',
       md5(string_agg(md5(filename || mime_type || data), ',' ORDER BY id))
FROM uploaded_images
UNION ALL
-- Hash of the hashes: these are the WhatsApp session credentials.
SELECT 'whatsapp_auth',
       md5(string_agg(md5(key || value), ',' ORDER BY key))
FROM whatsapp_auth
UNION ALL
SELECT 'social_posts',
       md5(string_agg(artist_id::text || '|' || status, ',' ORDER BY artist_id))
FROM social_posts;

\echo '== 7. sequences must sit at or above the largest id =='
SELECT 'artists' AS table_name, (SELECT max(id) FROM artists) AS max_id, last_value AS sequence_value
FROM pg_sequences WHERE sequencename = 'artists_id_seq'
UNION ALL SELECT 'votes', (SELECT max(id) FROM votes), last_value FROM pg_sequences WHERE sequencename = 'votes_id_seq'
UNION ALL SELECT 'requests', (SELECT max(id) FROM requests), last_value FROM pg_sequences WHERE sequencename = 'requests_id_seq'
UNION ALL SELECT 'pending_payments', (SELECT max(id) FROM pending_payments), last_value FROM pg_sequences WHERE sequencename = 'pending_payments_id_seq'
UNION ALL SELECT 'admin_audit_log', (SELECT max(id) FROM admin_audit_log), last_value FROM pg_sequences WHERE sequencename = 'admin_audit_log_id_seq'
UNION ALL SELECT 'uploaded_images', (SELECT max(id) FROM uploaded_images), last_value FROM pg_sequences WHERE sequencename = 'uploaded_images_id_seq'
UNION ALL SELECT 'nominee_notifications', (SELECT max(id) FROM nominee_notifications), last_value FROM pg_sequences WHERE sequencename = 'nominee_notifications_id_seq'
ORDER BY table_name;

\echo '== 8. indexes (the new ones must exist: votes_created_at_idx, job_leases) =='
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo '== 9. the tables the app needs are present =='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
