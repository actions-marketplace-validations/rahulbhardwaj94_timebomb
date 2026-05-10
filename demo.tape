Output docs/demo.gif
Output docs/demo.mp4

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 50ms

Type "cat demo/payment-retry.ts"
Enter
Sleep 3s

Type "clear"
Enter
Sleep 200ms

Type "node packages/cli/dist/index.js demo/payment-retry.ts"
Enter
Sleep 5s

Type "node packages/cli/dist/index.js explain settimeout-int32-overflow"
Enter
Sleep 5s
