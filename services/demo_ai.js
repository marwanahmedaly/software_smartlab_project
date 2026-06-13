/**
 * demo_ai.js — Fallback AI diagnostic engine when no external API key is available.
 * Provides keyword-based, realistic suggestions for common computer lab issues.
 */

const DIAGNOSTICS = {
  screen: {
    keywords: ['screen', 'display', 'monitor', 'flicker', 'line', 'vertical', 'horizontal', 'black', 'blank', 'no image', 'dark', 'color', 'resolution', 'pixel', 'dead'],
    causes: [
      'Loose or damaged display cable (HDMI/DisplayPort/VGA)',
      'Faulty monitor panel or backlight',
      'Incorrect resolution or refresh rate settings',
      'Overheating graphics card or integrated GPU failure',
      'Outdated or corrupted display driver',
      'Electromagnetic interference from nearby power sources'
    ],
    steps: [
      'Check cable connections on both monitor and PC ports',
      'Test the monitor with another device to isolate the issue',
      'Boot in Safe Mode to rule out driver issues',
      'Update or reinstall display adapter drivers',
      'Check GPU temperature and ensure proper airflow',
      'Try a different cable type (HDMI vs DisplayPort)'
    ],
    solution: 'Replace the display cable first. If the issue persists, update display drivers. If the monitor fails on another device, replace the monitor panel or backlight.'
  },
  keyboard: {
    keywords: ['keyboard', 'key', 'type', 'typing', 'stuck', 'unresponsive', 'spacebar', 'enter', 'shortcut', 'input', 'keys'],
    causes: [
      'Dust or debris under key switches',
      'Spilled liquid damage causing short circuits',
      'Outdated keyboard HID drivers',
      'Physical wear of key membrane or switches',
      'USB port power or connectivity issue',
      'Keyboard language layout mismatch'
    ],
    steps: [
      'Flip the keyboard and gently tap to remove debris',
      'Test with a different USB port or another keyboard',
      'Check Device Manager for driver errors',
      'Verify keyboard language/layout in OS settings',
      'Use compressed air to clean under the keys',
      'Test keyboard on another computer'
    ],
    solution: 'Clean the keyboard with compressed air. If specific keys are dead, replace the keyboard. For wireless keyboards, replace batteries and re-pair.'
  },
  mouse: {
    keywords: ['mouse', 'cursor', 'click', 'trackpad', 'scroll', 'pointer', 'double-click', 'drag', 'wireless mouse'],
    causes: [
      'Dirty optical sensor lens on the bottom',
      'Worn-out micro-switches under click buttons',
      'USB receiver or Bluetooth connectivity issue',
      'Surface too reflective or transparent for optical sensor',
      'Driver conflict or outdated HID driver',
      'Low battery (wireless) or damaged cable (wired)'
    ],
    steps: [
      'Clean the sensor lens with a soft cloth',
      'Test on a solid, non-reflective surface',
      'Try a different USB port or replace batteries',
      'Update mouse/ HID drivers in Device Manager',
      'Check for wireless interference from nearby routers',
      'Test with a spare mouse to isolate hardware failure'
    ],
    solution: 'Replace the mouse if the sensor or switches are worn. For wireless, ensure the receiver is within range and free of obstruction.'
  },
  network: {
    keywords: ['network', 'internet', 'wifi', 'ethernet', 'connection', 'cable', 'offline', 'disconnect', 'slow', 'ping', 'dns', 'router', 'ip', 'wifi', 'lan', 'download'],
    causes: [
      'Loose or damaged Ethernet cable or RJ-45 connector',
      'Network adapter driver corruption or outdated version',
      'DHCP lease expired or IP conflict in the subnet',
      'Firewall or antivirus blocking network traffic',
      'DNS resolution failure or misconfigured gateway',
      'Wi-Fi adapter power-saving mode causing dropouts'
    ],
    steps: [
      'Check physical cable and port LED indicators',
      'Run ipconfig /all or ifconfig to verify IP settings',
      'Ping the gateway and external DNS (8.8.8.8)',
      'Update network adapter drivers from manufacturer',
      'Temporarily disable firewall to test connectivity',
      'Renew DHCP lease: ipconfig /release then /renew'
    ],
    solution: 'Replace the Ethernet cable if damaged. Update drivers. If the issue is IP-related, assign a static IP or flush DNS cache (ipconfig /flushdns).'
  },
  slow: {
    keywords: ['slow', 'lag', 'freeze', 'hang', 'sluggish', 'stutter', 'performance', 'boot', 'startup', 'loading', 'speed', 'responsive', 'delay', 'bottleneck'],
    causes: [
      'High RAM or CPU usage from background processes',
      'Hard disk near full capacity or high fragmentation',
      'Outdated operating system or missing patches',
      'Too many startup programs loading at boot',
      'Malware or crypto-miner consuming resources',
      'Thermal throttling due to dust-clogged fans'
    ],
    steps: [
      'Open Task Manager / Activity Monitor to identify top resource consumers',
      'Run a full system antivirus scan',
      'Disable unnecessary startup programs in Task Manager',
      'Clean temporary files and clear browser cache',
      'Check disk health with SMART diagnostics or CrystalDiskInfo',
      'Upgrade RAM or switch to SSD if hardware is the bottleneck'
    ],
    solution: 'Free up disk space to at least 20% free. Add RAM if usage is consistently above 80%. Replace HDD with SSD for the biggest speed improvement.'
  },
  power: {
    keywords: ['power', 'turn on', 'won\'t start', 'boot', 'startup', 'beep', 'shut down', 'restart', 'black screen', 'no signal', 'fans', 'smell', 'burn', 'smoke', 'spark', 'power supply', 'psu'],
    causes: [
      'Failed or underpowered PSU (Power Supply Unit)',
      'Loose 24-pin motherboard or 8-pin CPU power cable',
      'Overheating triggering automatic thermal shutdown',
      'Short circuit on motherboard or front panel header',
      'Corrupted BIOS/UEFI firmware settings',
      'Faulty power button or front panel connector'
    ],
    steps: [
      'Check if the PSU fan spins when powered on',
      'Reseat all internal power cables (24-pin, 8-pin, SATA)',
      'Listen to POST beep codes and consult motherboard manual',
      'Clear CMOS by removing the battery for 30 seconds',
      'Test with a known-good PSU if available',
      'Inspect motherboard for swollen capacitors or burn marks'
    ],
    solution: 'Replace the PSU if it is non-responsive or emits a burning smell. If the motherboard has physical damage, replace the motherboard.'
  },
  sound: {
    keywords: ['sound', 'audio', 'speaker', 'microphone', 'headphone', 'volume', 'noise', 'static', 'buzz', 'distorted', 'mute', 'playback', 'recording', 'mic'],
    causes: [
      'Muted or low volume in OS mixer settings',
      'Wrong playback device selected as default',
      'Damaged or loose 3.5mm audio jack / USB connector',
      'Outdated or corrupted audio driver (Realtek, NVIDIA, etc.)',
      'Dust or debris in the headphone port',
      'Electromagnetic interference from unshielded cables'
    ],
    steps: [
      'Check Windows Volume Mixer and ensure the device is not muted',
      'Right-click the speaker icon and verify the correct default device',
      'Reinstall the audio driver from the device manufacturer',
      'Test with another pair of headphones or speakers',
      'Clean the audio jack with compressed air',
      'Check for Windows audio service status (services.msc)'
    ],
    solution: 'Reinstall the audio driver. If hardware is damaged, replace the internal speaker or use USB/Bluetooth audio as a workaround.'
  },
  software: {
    keywords: ['crash', 'error', 'blue screen', 'bsod', 'application', 'program', 'freeze', 'not responding', 'update', 'install', 'uninstall', 'virus', 'malware', 'driver', 'os'],
    causes: [
      'Incompatible software or recent update causing conflict',
      'Corrupted system files or registry entries',
      'Insufficient permissions or UAC blocking execution',
      'Malware infection corrupting system files',
      'Outdated application or missing runtime libraries (.NET, VC++)',
      'Disk bad sectors causing read errors on application files'
    ],
    steps: [
      'Run sfc /scannow and DISM to repair corrupted system files',
      'Check Event Viewer for specific error codes and modules',
      'Uninstall the problematic application and reinstall the latest version',
      'Run a full system scan with updated antivirus',
      'Install missing runtime libraries (Visual C++ Redistributables)',
      'Create a new Windows user profile to rule out profile corruption'
    ],
    solution: 'If the issue is software-specific, reinstall the application. For system-wide crashes, run system repair or perform a clean OS installation if necessary.'
  }
};

function matchCategory(description) {
  const lower = description.toLowerCase();
  for (const key of Object.keys(DIAGNOSTICS)) {
    if (DIAGNOSTICS[key].keywords.some(k => lower.includes(k))) {
      return key;
    }
  }
  return 'general';
}

function getGeneralSuggestion() {
  return `1) Possible causes:
   • Loose internal or external cable connection
   • Outdated device driver or firmware
   • Overheating due to dust accumulation
   • Power supply instability or voltage fluctuation
   • Software conflict or corrupted configuration

2) Inspection steps:
   • Check all physical connections (power, data cables)
   • Inspect the device for dust buildup and clean vents
   • Boot into Safe Mode to rule out software issues
   • Review Event Viewer / system logs for error codes
   • Test with a spare component if available

3) Recommended solution:
   • Restart the device and check for BIOS updates
   • Reinstall or update the relevant device driver
   • If the issue persists after cleaning and driver update, schedule a component replacement.`;
}

async function diagnose(description, deviceType = '', issueHistory = '') {
  const category = matchCategory(description);
  if (category === 'general') {
    return getGeneralSuggestion();
  }
  const d = DIAGNOSTICS[category];
  const lines = [
    `1) Possible causes:`,
    ...d.causes.map(c => `   • ${c}`),
    ``,
    `2) Inspection steps:`,
    ...d.steps.map(s => `   • ${s}`),
    ``,
    `3) Recommended solution:`,
    `   • ${d.solution}`
  ];
  if (deviceType) {
    lines.unshift(`Device: ${deviceType}`);
  }
  if (issueHistory) {
    lines.push(``, `Previous resolved issues for this device:`, issueHistory);
  }
  return lines.join('\n');
}

module.exports = { diagnose };
