import "./App.css";
import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { classname } from "@uiw/codemirror-extensions-classname";
import { json } from "@codemirror/lang-json";

function App() {
  const [value, setValue] = useState("");
  const [extensions, setExtensions] = useState([json({ jsx: true })]);
  var errorLines = [];

  function getMissingFields(content) {
    //Checking for missing field errors
    const pattern = /missing required field '([^']+)'/g;
    const patternMatch = content.matchAll(pattern);

    const missingFields = [];
    for (const match of patternMatch) {
      if (match && match.length === 2) {
        missingFields.push(match[1]);
      } else {
        console.log("No missing fields");
      }
    }
    return missingFields;
  }

  function getInvalidFields(content) {
    /*If the error is created by an invalid key/field, this will get the key where the error
    is from the error message, then this key can be used as the search string by the addPrefixToMatchingKey function*/
    const pattern = /field\s+'([^']+)'/g;
    const patternMatch = content.matchAll(pattern);

    let fieldValue = [];
    for (const match of patternMatch) {
      if (match && match.length === 2) {
        fieldValue.push(match[1]);
        console.log(`Field Value  ${fieldValue}`);
      } else {
        console.log("No match found.");
      }
    }
    return fieldValue;
  }

  function modifyInvalidValues(userInputJson, fieldValue) {
    /*If the error is created by a value, below code is used to navigate to that field. Then it will directly 
      add $$ to that value, so calling the addPrefixToMatchingKey function is not needed (this can be done because if the error
      is with a value, the error message will contain the path, if it is with a key, we have to use the 
      addPrefixToMatchingKey function to search for the location of the key in the json)*/
    const _ = require("lodash"); //Had to use a library because value can also be nested several levels deep

    if (fieldValue) {
      try {
        for (const fieldvalue of fieldValue) {
          const pattern = /\w+\[\d+\].*/; //If this matches we know there is a value error  (matches for sampleword[].)
          const pattern2 = /\w+\..*/;     //eg; (matches for sampleword. )
          if (fieldvalue.match(pattern) || fieldvalue.match(pattern2)) {
            // Get the current value
            const currentValue = _.get(userInputJson, fieldvalue);
            // Modify the value
            const modifiedValue = "$$" + currentValue;
            // Set the new value
            _.set(userInputJson, fieldvalue, modifiedValue); //Appending $$ to the key cant be done because keys are immutable so have to create a new key and append it to the json
          } else {
            continue;
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  function validateResourceType(content, fieldValue) {
    /*This will search error for below string and if there is a match the
      error is with the resourceType field*/
    let pattern = /(Failed to find FHIR profile for the resource type)/;
    const patternMatch = content.match(pattern);

    if (patternMatch && patternMatch.length === 2) {
      fieldValue.push("resourceType");
      console.log(`Field Value : ${fieldValue}`);
    }
  }

  function validateDateTime(content, fieldValue) {
    let pattern = /\$\.(\w+):pattern/g;
    const patternMatch = content.matchAll(pattern);

    for (const match of patternMatch) {
      fieldValue.push(match[1]);
    }
  }

  function addPrefixToMatchingKey(obj, searchString) {
    for (let key in obj) {
      if (key === searchString || key === "") {
        //if key is empty string, then the error is with the resourceType
        let entries = Object.entries(obj); //Similar to map

        // Iterate over the array
        for (let i = 0; i < entries.length; i++) {
          if (entries[i][0] === key) {
            // Replace the key
            entries[i][0] = "$$" + key;
          }
        }
        // Convert array back to object
        obj = Object.fromEntries(entries);
        return obj;
      }

      /*Here if the current key has an object as the value, this will execute*/
      if (typeof obj[key] === "object") {
        /*If the current key's value is an array containing many objects, then the else will execute therby recursively executing 
         addPrefixToMatchingKey for each object in the array. But if the current key's value is just a simple object, the the "if" will run
         executind addPrefixToMatchingKey for the current object*/
        if (!Array.isArray(obj[key])) {
          let obj2 = addPrefixToMatchingKey(obj[key], searchString);
          obj[key] = obj2;
        } else {
          for (const arrayElementIndex in obj[key]) {
            let obb = addPrefixToMatchingKey(
              obj[key][arrayElementIndex],
              searchString
            );
            obj[key][arrayElementIndex] = obb;
          }
        }
      }
    }
    return obj;
  }

  function findErrorLines(userInputJson, fieldValue, errorLines) {
    let jsonAfterLoop;
    for (const field of fieldValue) {
      jsonAfterLoop = addPrefixToMatchingKey(userInputJson, field);
      userInputJson = jsonAfterLoop;
    }
    let jsonStringg = JSON.stringify(jsonAfterLoop, null, 2); // 2 is the number of spaces for indentation

    //Finds error locations by getting the line numbers where $$ is present
    if (jsonStringg) {
      let linesArr = jsonStringg.split("\n");

      for (let i = 0; i < linesArr.length; i++) {
        if (linesArr[i].includes("$$")) {
          linesArr[i] = linesArr[i].replace("$$", "");
          errorLines.push(i);
        }
      }
      let modifiedJsonStringg = linesArr.join("\n");
      //  document.getElementById('content').innerHTML = `<pre>${modifiedJsonStringg}</pre>`;
      setValue(modifiedJsonStringg);
    }
  }

  function displayErrorMessages(content, missingFields, errorLines) {
    if (!content && missingFields.length === 0) {
      document.getElementById(
        "errorMsg"
      ).innerHTML = `<b>Validation successful</b>`;
      return;
    } else {
      document.getElementById("errorMsg").innerHTML = ""; //removes the previous content

      if (missingFields.length !== 0) {
        for (const missingValue of missingFields) {
          document.getElementById(
            "errorMsg"
          ).innerHTML += `<b><p>Missing required field: ${missingValue}</p></b>`;
        }
      }

      let pattern = /'health\.fhir\.r4\.international401:\w+':\s*([\s\S]*)/;
      const patternMatch = content.match(pattern);

      if (patternMatch !== null && patternMatch[1] !== "") {
        const errorMessagesArray = patternMatch[1].split("\n");
        for (let i = 0; i < errorMessagesArray.length; i++) {
          errorMessagesArray[i] = `Line ${errorLines[i]+1}) ${errorMessagesArray[i]} `;
        }
        for (const error of errorMessagesArray) {
          document.getElementById(
            "errorMsg"
          ).innerHTML += `<b><p>${error}<p></b>`;
        }
      } else {
        document.getElementById("errorMsg").innerHTML += `<b>${content}</b>`;
      }
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    let userInputJson;
    try {
      userInputJson = JSON.parse(value);
    } catch (error) {
      console.log(error.message);
      document.getElementById(
        "errorMsg"
      ).innerHTML = `<b>Invalid JSON format: ${error.message}</b>`;
      return;
    }

    const data = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userInputJson),
    };

    let content;
    try {
      const response = await fetch("http://localhost:9090/sampleResource", data);
      content = await response.text();
      console.log("Error message from server : " + content);
    } catch (error) {
      console.error('There was a problem with the fetch operation: ', error);
      return;
    }

    //Get the missing field names (if any)
    const missingFields = getMissingFields(content);

    //Removed the errors related to missing fields from the original error message so they can be handled seperately
    const removeMsg = /missing required field.*\n?/g;
    content = content.replace(removeMsg, "");
    console.log("+++++++++++")
    console.log(content);

    //Gets the field names where there are errors
    const fieldValue = getInvalidFields(content);

    //If the error is created by a value, this will add $$ to that value
    modifyInvalidValues(userInputJson, fieldValue);

    //Resource type validation
    validateResourceType(content, fieldValue);

    /*Parsing for dateTime errors*/
    validateDateTime(content, fieldValue);

    //Finds error locations by getting the line numbers where $$ is present
    findErrorLines(userInputJson, fieldValue, errorLines);

    //Highlighting the lines with errors
    if (!content && missingFields.length === 0) {
      setExtensions([json({ jsx: true })]); //Hides the line highlights when succesful
    } else {
      setExtensions([classnameExt, json({ jsx: true })]); //Highlights the lines when having errors
    }

    displayErrorMessages(content, missingFields, errorLines);
  };

  const classnameExt = classname({
    add: (lineNumber) => {
      for (const line of errorLines) {
        if (line === lineNumber - 1) {
          return "errorMarker";
        }
      }
    },
  });

  return (
    <div className="App">
      <div className="container">
        <form onSubmit={handleSubmit}>
          <CodeMirror
            className="codeMirror"
            value={value}
            height="400px"
            width="500px"
            placeholder="Enter your FHIR resource here"
            // extensions={[classnameExt, json({ jsx: true })]}
            extensions={extensions}
            onChange={(value) => {
              setValue(value);
              if (value === "") {
                setExtensions([json({ jsx: true })]);
              }
            }}
            theme="light"
          />
          <button>Submit</button>
        </form>
        {/* <div id='content'></div>      */}
        <div id="errorMsg"></div>
      </div>
    </div>
  );
}

export default App;
