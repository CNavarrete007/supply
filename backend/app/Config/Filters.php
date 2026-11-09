<?php

namespace Config;

use App\Filters\ApiBoundary;
use CodeIgniter\Config\Filters as BaseFilters;

class Filters extends BaseFilters
{
    public array $aliases = ['apiBoundary' => ApiBoundary::class];
    public array $required = ['before' => ['apiBoundary'], 'after' => ['apiBoundary']];
    public array $globals = ['before' => [], 'after' => []];
    public array $methods = [];
    public array $filters = [];
}
