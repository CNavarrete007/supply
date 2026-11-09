<?php

declare(strict_types=1);

namespace App\Database\SessionMySQLi;

use App\Database\SessionContract;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\Database\MySQLi\Connection as MySQLiConnection;
use mysqli;
use Throwable;

/** Applies the database contract to EVERY connection, including reconnects. */
final class Connection extends MySQLiConnection
{
    public string $passwordFile = '/run/secrets/api_db_password';

    public function __construct(array $params)
    {
        // Use CI's MySQLi query builder/results/forge after selecting this factory.
        $params['DBDriver'] = 'MySQLi';
        parent::__construct($params);
    }

    public function connect(bool $persistent = false)
    {
        $connection = null;

        try {
            if ($persistent || $this->username === '' || strtolower($this->username) === 'root') {
                throw new DatabaseException('Invalid application database configuration.');
            }

            // Read only when a DB connection is requested. Liveness needs no secret/DB.
            if (! is_file($this->passwordFile) || ! is_readable($this->passwordFile)) {
                throw new DatabaseException('Database secret is unavailable.');
            }

            $secret = file_get_contents($this->passwordFile);
            if ($secret === false) {
                throw new DatabaseException('Database secret is unavailable.');
            }

            $this->password = rtrim($secret, "\r\n");
            unset($secret);

            if ($this->password === '' || str_contains($this->password, "\0")) {
                throw new DatabaseException('Database secret is invalid.');
            }

            $connection = parent::connect(false);
            if (! $connection instanceof mysqli) {
                throw new DatabaseException('Database connection is unavailable.');
            }

            SessionContract::initialize($connection, $this->database);

            return $connection;
        } catch (Throwable) {
            if ($connection instanceof mysqli) {
                try {
                    $connection->close();
                } catch (Throwable) {
                    // The server may already have closed the failed connection.
                }
            }

            // Do not preserve an inner exception containing host/user/password/SQL.
            throw new DatabaseException('Application database connection is not ready.');
        } finally {
            $this->password = '';
        }
    }
}
