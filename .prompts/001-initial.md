Make a Chrome extension that allows me to navigate the Github code review pages using:
 - j to move down a file
 - k to move up a file
 - x to mark the file as viewed
 - space to open/close the code view of the file
 - p to open the "Submit review" dialog

Files on the Github code review page look like what's in `github_code_review_individual_files.html`
it contains two files/diff views, as they appear in HTML of the actual page.
There's no HTML in between the two `<div>`s on the actual Github code review page, just like in
this .html-file.

The "Submit review" looks like what's in `github_code_review_submit_review_button.html`.

Github has its own set of keyboard shortcuts, so we need ours to "override" them and not
trigger any native Github keybinding underneath.
