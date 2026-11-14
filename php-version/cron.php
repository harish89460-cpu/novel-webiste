<?php
declare(strict_types=1);

require_once __DIR__ . '/scheduler.php';

$result = publish_due_articles();
echo json_encode($result, JSON_UNESCAPED_SLASHES) . PHP_EOL;
