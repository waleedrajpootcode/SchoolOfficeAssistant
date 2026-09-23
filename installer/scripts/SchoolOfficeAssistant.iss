#define MyAppName "School Office Assistant"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "School Office Assistant"

[Setup]
AppId={{A8F4E7D1-5E2C-4B91-9D63-7A21C8F04B55}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}

SetupIconFile=..\assets\SchoolOfficeAssistant.ico
UninstallDisplayIcon={app}\SchoolOfficeAssistant.ico

DefaultDirName={autopf}\School Office Assistant
DefaultGroupName={#MyAppName}

OutputDir=..\output
OutputBaseFilename=SchoolOfficeAssistant-Setup

Compression=lzma
SolidCompression=yes

ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

DisableProgramGroupPage=yes
WizardStyle=modern

[Dirs]
Name: "{commonappdata}\SchoolOfficeAssistant\data"; Permissions: users-modify

[Files]
Source: "..\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\SchoolOfficeAssistant.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\assets\SchoolOfficeAssistant.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\School Office Assistant"; Filename: "{app}\SchoolOfficeAssistant.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\SchoolOfficeAssistant.ico"
Name: "{group}\School Office Assistant"; Filename: "{app}\SchoolOfficeAssistant.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\SchoolOfficeAssistant.ico"

[Run]
Filename: "{app}\SchoolOfficeAssistant.cmd"; WorkingDir: "{app}"; Description: "Launch School Office Assistant"; Flags: postinstall nowait skipifsilent