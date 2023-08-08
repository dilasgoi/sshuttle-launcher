const blessed = require('blessed');
const { spawn } = require('child_process');
const fs = require('fs');

// Read config file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Create a screen object.
const screen = blessed.screen({
  smartCSR: true,
  mouse: true,
  fullUnicode: true,
});

let buttons = [];
let processes = {};
let checkConnections = {};

// Create an output box for displaying command outputs
const outputBox = blessed.box({
  top: '50%',
  left: 0,
  width: '100%',
  height: '50%',
  tags: true,
  border: {
    type: 'line',
  },
  scrollable: true,
  scrollbar: {
    ch: ' ',
    inverse: true,
  },
});
screen.append(outputBox);

// Function to create buttons
const createButtons = () => {
  // Calculate the button size based on screen size
  const buttonWidth = Math.floor(screen.width / config.length);
  const buttonHeight = Math.floor(screen.height / 2); // Adjust height for output box

  // Remove old buttons
  buttons.forEach((button) => {
    screen.remove(button);
  });
  buttons = [];

  // Create a button for each config entry
  config.forEach((entry, index) => {
    const button = blessed.box({
      top: 0,
      left: index * buttonWidth,
      width: buttonWidth,
      height: buttonHeight,
      content: `Server: ${entry.sshserver}\nUser: ${entry.username}`,
      align: 'center',
      valign: 'middle',
      style: {
        bg: 'red',
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
      },
      tags: true,
      border: {
        type: 'line',
      },
      mouse: true,
      hoverEffects: {
        bg: 'green',
      },
    });

    button.on('click', function () {
      if(processes[entry.sshserver]) {
        // Kill the running process with SIGKILL
        process.kill(-processes[entry.sshserver].pid, 'SIGKILL');
        delete processes[entry.sshserver];

        // Stop checking the connection
        clearInterval(checkConnections[entry.sshserver]);
        delete checkConnections[entry.sshserver];

        // Reset button color and content
        button.style.bg = 'red';
        button.setContent(entry.sshserver);
        outputBox.setContent(outputBox.getContent() + `\nDisconnected from ${entry.sshserver}`);
        screen.render();
      } else {
        // Check SSH connection
        const sshCheck = spawn(`ssh -q ${entry.username}@${entry.sshserver} exit`, { shell: true });

        sshCheck.on('exit', (code) => {
          if(code !== 0) {
            // SSH check failed, aborting
            outputBox.setContent(outputBox.getContent() + `\nSSH connection with ${entry.sshserver} impossible`);
            screen.render();
            return;
          }

          // Run the sshuttle command
          const command = `sshuttle -x ${entry.sshserver} -r ${entry.username}@${entry.sshserver} -N`;
          processes[entry.sshserver] = spawn(command, { shell: true, detached: true });

          // Start checking the connection
          checkConnections[entry.sshserver] = setInterval(() => {
            if (processes[entry.sshserver]) {
              button.style.bg = 'green';
              button.setContent(`Connected to ${entry.sshserver}`);
              outputBox.setContent(outputBox.getContent() + `\nConnected to ${entry.sshserver}`);
              screen.render();

              // Stop checking the connection
              clearInterval(checkConnections[entry.sshserver]);
              delete checkConnections[entry.sshserver];
            }
          }, 1000);
        });
      }
    });

    screen.append(button);
    buttons.push(button);
  });

  screen.render();
};

// Initial creation
createButtons();

// Recreate buttons when screen size changes
screen.on('resize', () => {
  createButtons();
});

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render();

