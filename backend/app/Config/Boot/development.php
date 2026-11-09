<?php

// The environment is development, but this API never returns debug traces.
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('zend.exception_ignore_args', '1');
defined('SHOW_DEBUG_BACKTRACE') || define('SHOW_DEBUG_BACKTRACE', false);
defined('CI_DEBUG') || define('CI_DEBUG', false);
