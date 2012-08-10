<?
@session_start();

if (!$_SESSION['feed'])
{
    $_SESSION['feed'] = true;
    $_SESSION['status'][] = "Releasing Kernel.js 0.8.4!";
    $_SESSION['status'][] = "Working on examples.";
    $_SESSION['status'][] = "Started a new journal app today.";
}

$method = $_SERVER['REQUEST_METHOD'];
$method = strtolower($method);
$url    = $_SERVER['REQUEST_URI'];
$url    = str_replace('/kerneljs/ajax.php/', '', $url);

switch ($url)
{
    case 'feed':
        switch ($method)
        {
            case 'GET':
            default:
                getStatusFeed();
                exit();
        }
        break;
    
    case 'status':
        switch ($method)
        {
            case 'POST':
            default:
                addStatus();
                exit();
        }
        break;
            
    default:
        exit();
}

function getStatusFeed()
{
    echo json_encode(array_reverse($_SESSION['status']));
}

function addStatus()
{
    $arr = array();
    $arr['success'] = true;
    
    $_SESSION['status'][] = $_REQUEST['newstatus'];
    
    echo json_encode($arr);
}

?>