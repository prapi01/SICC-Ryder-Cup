#!/bin/sh
# Use ~/ to guarantee it finds the folder from the user home root
cd ~/Documents/SICC-Ryder-Cup || exit 1

# Pull down any out-of-sync web updates from GitHub
lg2 pull

# Move the capital C.jpg from your Documents folder into the repo images folder
mv -f ~/Documents/C.jpg ./images/celebration/C.jpg

# Stage, commit, and push up
lg2 add images/celebration/C.jpg
lg2 commit -m "Update celebration photo"
lg2 push