<?php

define('PATH_BUILD', __DIR__ . '/');
define('PATH_SRC', realpath(__DIR__ . '/../src/') . '/');
define('PATH_DIST', realpath(__DIR__ . '/../dist/') . '/');

define('PATH_JAVA', '"C:\Program Files (x86)\Java\jre6\bin\java.exe"');
define('PATH_YUI', 'D:\www\rsrc\lib\yuicompressor-2.4.6.jar');

$prefix = isset($_GET['f']) !== FALSE ? $_GET['f'] : '*';
$versionNumber = isset($_GET['v']) !== FALSE ? $_GET['v'] : '';

$buffer = '';
$passed = array();

foreach (glob(PATH_SRC . $prefix . '.*.js') as $filename) {
    $buffer .= PHP_EOL . PHP_EOL . file_get_contents($filename);
}

$buffer = preg_replace('/\$Id\$/s', $versionNumber, $buffer);
$buffer = preg_replace('/\$dateTime\$/s', date('m/d/y', time()), $buffer);

$filePathAndName = PATH_DIST . $prefix . '.js';
file_put_contents($filePathAndName, $buffer);

$minifiedFilePathAndName = PATH_DIST . $prefix . '-' . $versionNumber . '.min.js';
exec(sprintf(PATH_JAVA . ' -jar ' . PATH_YUI .  ' --type %s --charset %s -o %s %s',
             'js',
             'utf-8',
             $minifiedFilePathAndName,
             $filePathAndName));

?>