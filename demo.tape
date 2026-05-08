Output docs/demo.gif
Output docs/demo.mp4

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 600
Set Theme "Dracula"
Set Padding 16
Set TypingSpeed 50ms

Hide
Type "/tmp/setup_demo.sh"
Enter
Sleep 500ms
Show

Type "node packages/cli/dist/index.js /tmp/bad-code.ts"
Enter
Sleep 5s

Type "node packages/cli/dist/index.js rules"
Enter
Sleep 2s

Type "node packages/cli/dist/index.js explain settimeout-int32-overflow"
Enter
Sleep 3s
