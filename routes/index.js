var express = require('express');
var fs = require('fs');
var Netmask = require('netmask').Netmask;
var router = express.Router();
const spawnSync = require('child_process').spawnSync;
const { body, validationResult, check } = require('express-validator');
var validator = require('validator');
// get the /etc/dhcpcd.conf file content
let config, configArray, paramsArray, keyArray,ip_address, routers,domain_name_servers,dhcp,ip_subnet;

/* GET home page. */
router.get('/', function(req, res, next) {
  // get the actual data
      try {
        config = (fs.readFileSync("/etc/dhcpcd.conf")).toString();
      } catch (e) {
        throw e;
      }

      // create an array to manage the config
      configArray = config.split('\n');



      dhcp = false;
      for (let index in configArray) {
        if (configArray[index].includes('interface eth0'))
        {
          if (configArray[index][0] == '#') {
            dhcp = true;

          }
        }
        if (configArray[index].includes('static ip_address'))
        {
          var block = new Netmask(configArray[index].split('=')[1]);
          ip_address = configArray[index].split('=')[1].split('/')[0];
          ip_subnet = block.mask;
        }
        if (configArray[index].includes('static routers'))
        {
          routers = configArray[index].split('=')[1];
        }
        if (configArray[index].includes('static domain_name_servers'))
        {
          domain_name_servers = configArray[index].split('=')[1];
        }
        if (configArray[index].includes('profile static_eth0'))
        {
          break;
        }
      }
  console.log("dhcp"+dhcp);
  res.render('index', { title: 'Raspberry Pi IP config',
                        dhcp: dhcp,
                        ip_address : ip_address,
                        ip_subnet : ip_subnet,
                        routers : routers,
                        domain_name_servers : domain_name_servers

 });
});


router.post('/',
  body('chk_dhcp').toBoolean(),
  body('txt_ip_address').optional().trim().isIP(),
  body('txt_ip_subnet').optional().trim().isIP(),
  body('txt_dns').optional().custom((value, { req }) => {
    console.log(value);
    if (!req.body.chk_dhcp)
    {
      var str_array = value.trim().split(/\s+/);
      console.log(str_array)
      for (const item2 of str_array)
      {
        console.log(item2)
        if (!validator.isIP(item2))
          return false;
      }
    }
    return true;
  }),
  body('txt_routers').optional().trim().isIP(),
  function (req, res) {
  console.log(req.body.chk_dhcp);
  console.log(req.body.txt_ip_address);
  console.log(req.body.txt_ip_subnet);
  console.log(req.body.txt_routers);
  console.log(req.body.txt_dns);


  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req);
  if (!errors.isEmpty()) {


    //return res.status(400).json({ errors: errors.array() });
    res.render('index', { title: 'Raspberry Pi IP config',
                          dhcp: req.body.chk_dhcp,
                          ip_address : req.body.txt_ip_address,
                          ip_subnet : req.body.txt_ip_subnet,
                          routers : req.body.txt_routers,
                          domain_name_servers : req.body.txt_dns,
                          errors: errors.errors
                          });
    return;
  }


  keyArray = [
    `interface eth0`,
    `static ip_address`,
    `static routers`,
    `static domain_name_servers`
  ];

  try {
    config = (fs.readFileSync("/etc/dhcpcd.conf")).toString();
  } catch (e) {
    throw e;
  }

  // create an array to manage the config
  configArray = config.split('\n');

  if (!req.body.chk_dhcp) {
    var block = new Netmask(`${req.body.txt_ip_address}/${req.body.txt_ip_subnet}` );

    paramsArray = [
      `interface eth0`,
      `static ip_address=${req.body.txt_ip_address}/${block.bitmask}`,
      `static routers=${req.body.txt_routers}`,
      `static domain_name_servers=${req.body.txt_dns}`,
    ];

    // push the new config if we want static ip
    for (let index in configArray) {
      if (!configArray[index])
      {
        console.log('undefined');
        continue;
      }
      if (configArray[index].includes('profile static_eth0'))
      {
        console.log('profile static_eth0');
        break;
      }
      if (configArray[index].includes(`static ip6_address`)&&configArray[index][0] === '#')
      {
        //uncomment
        configArray[index] = `${configArray[index].split('#')[1]}`;
        continue;
      }
      var i =0;
      for (let param of keyArray) {

        if ( configArray[index].includes(param)) {

          configArray[index]=paramsArray[i];
          break;
        }
        i++;
      }
    }
  }
  else { //dhcp
    for (let index in configArray) {
      if (configArray[index].includes('profile static_eth0'))
      {
        break;
      }
      for (let param of keyArray) {
        if (configArray[index].includes(param)) {
          // is commented out?
          if (configArray[index][0] !== '#') {
            // comment out
            configArray[index] = `#${configArray[index]}`
          }

        }
      }
    }
  }


  // create a string managing multiple new lines
  const output = configArray.join('\n');
  // save the string into /tmp/dhcpcd.conf
  fs.writeFileSync("/tmp/dhcpcd.conf", output);



  // copy it to /boot as root
  if (!process.env.NODE_ENV||process.env.NODE_ENV!=='development') {
    console.log('production! writing to /etc/dhcpcd.conf and rebooting');
    spawnSync('sudo', ['cp', '/tmp/dhcpcd.conf', '/etc/dhcpcd.conf']);
    setTimeout(() => spawnSync('sudo', ['reboot']), 500);
  }
  else {
      console.log("env: "+process.env.NODE_ENV);
  }

    res.render('rebooting', { title: 'Raspberry Pi IP config'});
});

module.exports = router;
