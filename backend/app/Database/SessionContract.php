<?php

declare(strict_types=1);

namespace App\Database;

use mysqli;
use mysqli_result;
use RuntimeException;

/** Session-only settings: never creates, imports, migrates, or alters application data. */
final class SessionContract
{
    public const COLLATION = 'utf8mb4_uca1400_nopad_ai_ci';
    public const SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION,NO_ZERO_DATE,NO_ZERO_IN_DATE';

    public static function initialize(mysqli $connection, string $schema): void
    {
        foreach ([
            "SET NAMES utf8mb4 COLLATE " . self::COLLATION,
            "SET SESSION time_zone = '+00:00'",
            "SET SESSION sql_mode = '" . self::SQL_MODE . "'",
            'SET SESSION foreign_key_checks = 1',
            'SET SESSION check_constraint_checks = 1',
            'SET SESSION unique_checks = 1',
            'SET SESSION innodb_strict_mode = 1',
        ] as $statement) {
            if ($connection->query($statement) !== true) {
                throw new RuntimeException('Database session initialization failed.');
            }
        }

        self::inspect($connection, $schema);
    }

    /** @return array{engine: string, schema: string} */
    public static function inspect(mysqli $connection, string $schema): array
    {
        $result = $connection->query(<<<'SQL'
            SELECT VERSION() AS server_version,
                DATABASE() AS schema_name,
                @@session.character_set_client AS charset_client,
                @@session.character_set_connection AS charset_connection,
                @@session.character_set_results AS charset_results,
                @@session.collation_connection AS connection_collation,
                @@session.time_zone AS session_timezone,
                @@session.sql_mode AS session_sql_mode,
                @@session.foreign_key_checks AS fk_checks,
                @@session.check_constraint_checks AS check_checks,
                @@session.unique_checks AS unique_checks,
                @@session.innodb_strict_mode AS innodb_strict
            SQL);

        if (! $result instanceof mysqli_result) {
            throw new RuntimeException('Database session verification failed.');
        }

        $row = $result->fetch_assoc();
        $result->free();

        if (! is_array($row)) {
            throw new RuntimeException('Database session verification failed.');
        }

        $version = (string) $row['server_version'];
        if (! str_contains($version, 'MariaDB')
            || ! preg_match('/^(\d+\.\d+\.\d+)/', $version, $matches)
            || version_compare($matches[1], '11.8.9', '<')
            || version_compare($matches[1], '12.0.0', '>=')) {
            throw new RuntimeException('Unsupported database engine.');
        }

        $expected = [
            'schema_name' => $schema,
            'charset_client' => 'utf8mb4',
            'charset_connection' => 'utf8mb4',
            'charset_results' => 'utf8mb4',
            'connection_collation' => self::COLLATION,
            'session_timezone' => '+00:00',
            'fk_checks' => '1',
            'check_checks' => '1',
            'unique_checks' => '1',
            'innodb_strict' => '1',
        ];

        foreach ($expected as $key => $value) {
            if ((string) $row[$key] !== $value) {
                throw new RuntimeException('Database session contract does not match.');
            }
        }

        $modes = explode(',', strtoupper((string) $row['session_sql_mode']));
        if (array_diff(explode(',', self::SQL_MODE), $modes) !== []) {
            throw new RuntimeException('Database strict mode does not match.');
        }

        return ['engine' => 'MariaDB', 'schema' => $schema];
    }
}
