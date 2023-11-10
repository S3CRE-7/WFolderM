const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const app = express();
const port = 5183;
app.use('/public', express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload()); // Add this line to enable file uploads

// Use __dirname to get the directory where the app is located
const directoryPath = __dirname;
const parentDirectory = path.dirname(directoryPath);
const publicDirectory = path.join(directoryPath, 'public');

// Function to read the HTML template file
function readHtmlTemplate(callback) {
  const templatePath = path.join(__dirname, 'template.html');

  fs.readFile(templatePath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      callback(err, null);
    } else {
      callback(null, data);
    }
  });
}

app.get('/folders', (req, res) => {
  // Read the contents of the parent directory
  fs.readdir(parentDirectory, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // Filter out only directories and exclude "System Volume Information"
      const folders = files
        .filter(file => {
          try {
            return fs.statSync(path.join(parentDirectory, file)).isDirectory() && file !== 'System Volume Information';
          } catch (e) {
            return false; // Skip this directory if there's an error
          }
        });

      res.json({ folders });
    }
  });
});

// Function to create a thm.png file in each folder
function createThumbnails(folders) {
  folders.forEach(folder => {
    const publicFolder = path.join(publicDirectory, folder);
    if (!fs.existsSync(publicFolder)) {
      fs.mkdirSync(publicFolder);
    }

    const thumbnailPath = path.join(publicFolder, 'thm.png');
    if (!fs.existsSync(thumbnailPath)) {
      // Create a placeholder image or copy an existing one to thm.png
      const placeholderPath = path.join(__dirname, 'placeholder.png');
      if (fs.existsSync(placeholderPath)) {
        fs.copyFileSync(placeholderPath, thumbnailPath);
      } else {
        // Alternatively, you can create a simple placeholder image
        fs.writeFileSync(thumbnailPath, ''); // Create an empty file as a placeholder
      }
    }
  });
}

app.post('/update-thumbnail', (req, res) => {
  const folderToUpdate = req.body.folder;

  // Handle the file upload and update the thumbnail
  // Assuming the file is sent as a form-data POST request
  const uploadedFile = req.files && req.files.thumbnail;

  if (uploadedFile) {
    const thumbnailPath = path.join(publicDirectory, folderToUpdate, 'thm.png');

    uploadedFile.mv(thumbnailPath, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      } else {
        res.redirect('/');
      }
    });
  } else {
    res.status(400).send('No thumbnail file provided');
  }
});

// ...

app.get('/:folder?', (req, res) => {
  const requestedFolder = req.params.folder || `default`; // Use 'default' as a default folder name
  const folderPath = path.join(publicDirectory, requestedFolder);

  // Check if the folder exists, if not, create it
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  // Read the contents of the parent directory
  fs.readdir(parentDirectory, (err, files) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Filter out only directories and exclude "System Volume Information"
      const folders = files
        .filter(file => {
          try {
            return fs.statSync(path.join(parentDirectory, file)).isDirectory() && file !== 'System Volume Information';
          } catch (e) {
            return false; // Skip this directory if there's an error
          }
        });

      // Create folders in the public directory with the same names as in the parent directory
      createThumbnails(folders);

      // Read the HTML template file
      readHtmlTemplate((err, template) => {
        if (err) {
          res.status(500).send('Internal Server Error');
        } else {
          // Create an HTML list of the folders with links to open in the file manager
          const folderList = `${folders.map(folder => `
            <div class="card">
              <img src="/public/${folder}/thm.png" alt="">
              ${folder}
              <a href="file://${folder}" target="_blank">Open in File Manager</a>
            </div>
          `).join('')}`;

          // Replace a placeholder in the template with the folder list
          const htmlResponse = template.replace('{{folderList}}', folderList);

          // Send the HTML response
          res.send(htmlResponse);
        }
      });
    }
  });
});

// ...

// Use port 0 to automatically select an available port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
