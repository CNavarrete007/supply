<?php

namespace Config;

use CodeIgniter\Database\Config;
use RuntimeException;

class Database extends Config
{
    public string $filesPath = APPPATH . 'Database' . DIRECTORY_SEPARATOR;
    public string $defaultGroup = 'default';

    public array $default = [
        'DSN' => '',
        'hostname' => 'db',
        'username' => 'supplyflow_api_local',
        'password' => '',
        'passwordFile' => '/run/secrets/api_db_password',
        'database' => 'supplyflow_dev',
        'DBDriver' => 'App\\Database\\SessionMySQLi',
        'DBPrefix' => '',
        'pConnect' => false,
        'DBDebug' => false,
        'charset' => 'utf8mb4',
        'DBCollat' => 'utf8mb4_uca1400_nopad_ai_ci',
        'swapPre' => '',
        'encrypt' => false,
        'compress' => false,
        'strictOn' => true,
        'failover' => [],
        'port' => 3306,
        'numberNative' => false,
        'foundRows' => false,
        'dateFormat' => ['date' => 'Y-m-d', 'datetime' => 'Y-m-d H:i:s', 'time' => 'H:i:s'],
    ];

    public function __construct()
    {
        parent::__construct();

        foreach ([
            'hostname' => 'DB_HOST',
            'username' => 'DB_USERNAME',
            'database' => 'DB_DATABASE',
            'passwordFile' => 'DB_PASSWORD_FILE',
        ] as $property => $variable) {
            $value = getenv($variable);
            if ($value !== false && $value !== '') {
                $this->default[$property] = $value;
            }
        }

        $port = getenv('DB_PORT');
        if ($port !== false && $port !== '') {
            $port = filter_var($port, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
            if ($port === false) {
                throw new RuntimeException('Invalid database port configuration.');
            }
            $this->default['port'] = $port;
        }
    }
}
