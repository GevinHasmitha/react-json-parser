import "./App.css";
import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { classname } from "@uiw/codemirror-extensions-classname";
import { json } from "@codemirror/lang-json";

function App() {
  const [value, setValue] = useState("");
  const [extensions, setExtensions] = useState([json({ jsx: true })]);
  var errorLines = [];

  function checkForMissingFields(errorData) {
    for (let data of errorData){
      let pattern = /missing required field '([^']+)'/;
      const patternMatch = data.match(pattern);
      if (patternMatch && patternMatch.length === 2){
        console.log(patternMatch[1]);
        return true;
      }else{
        return false;
      }
    }
  }

  function validateInvalidFields(errorData,userInputJson){
    console.log("Invalid Fields---------------------------")
    for (let data of errorData){
      let pattern = /Invalid field '([^']*)'/;
      const patternMatch = data.match(pattern);
      if (patternMatch && patternMatch.length === 2){
       console.log(patternMatch[1]);
       userInputJson = addPrefixToMatchingKey(userInputJson, patternMatch[1]);
      }
    }
    return userInputJson;
  }

  function validateInvalidValues(errorData, userInputJson){
    console.log("Invalid Value---------------------------")
    for (let data of errorData){
      let pattern = /Invalid value of field '([^']*)'/;
      const patternMatch = data.match(pattern);
      if (patternMatch && patternMatch.length === 2){
       console.log(patternMatch[1]);
        modifyInvalidValues(userInputJson, patternMatch[1]);
      }
     }
  }

  function validateDateTime(errorData,userInputJson) {
    for (let data of errorData){
      let pattern =/Invalid pattern \(constraint\) for field '([^']*)'/;
      const patternMatch = data.match(pattern);
      if (patternMatch && patternMatch.length === 2){
        console.log("zzzzzzzzzzzzzzzzzzzz");
       console.log(patternMatch[1]);
       userInputJson = addPrefixToMatchingKey(userInputJson, patternMatch[1]);
      }
     }
     return userInputJson;
    }


  function modifyInvalidValues(userInputJson, fieldvalue) {
    /*If the error is created by a value, below code is used to navigate to that field. Then it will directly 
      add $$ to that value, so calling the addPrefixToMatchingKey function is not needed (this can be done because if the error
      is with a value, the error message will contain the path, if it is with a key, we have to use the 
      addPrefixToMatchingKey function to search for the location of the key in the json)*/
    const _ = require("lodash"); //Had to use a library because value can also be nested several levels deep

    if (fieldvalue) {
      try {
            // Get the current value
            const currentValue = _.get(userInputJson, fieldvalue);
            console.log("Current value: " + currentValue);
            console.log(JSON.stringify(userInputJson))
            // Modify the value
            const modifiedValue = "$$" + currentValue;
            // Set the new value
            _.set(userInputJson, fieldvalue, modifiedValue); //Appending $$ to the key cant be done because keys are immutable so have to create a new key and append it to the json
      } catch (error) {
        console.error(error);
      }
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

  function findErrorLines(userInputJson, errorLines) {
    let jsonStringg = JSON.stringify(userInputJson, null, 2); // 2 is the number of spaces for indentation

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

  function displayErrorMessages(errorData) {
    document.getElementById("errorMsg").innerHTML  = ``;

    let j=0;
    for(let i=0; i< errorData.length; i++){
      if (
        errorData[i].includes("Missing required field") ||
        errorData[i].includes("Resource type is invalid") ||
        errorData[i].includes("Missing required Element") ||
        errorData[i].includes("may be missing or invalid or it's value invalid")
      ) {
        document.getElementById(
          "errorMsg"
        ).innerHTML += `<b>${errorData[i]}<br><br><b>`;
      } else {
        document.getElementById("errorMsg").innerHTML += `<b>Line ${
          errorLines[j] + 1
        }) ${errorData[i]}<br><br><b>`;
        j++;
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
      if (content.length === 0){
        console.log("Validation successful");
        setExtensions([json({ jsx: true })]);
        document.getElementById("errorMsg").innerHTML = `<b>Validation Successful<b>`;
        return;
      }else{
        console.log("Error message from server : " + content);
      }
      
    } catch (error) {
      console.error('There was a problem with the fetch operation: ', error);
      return;
    }

    let errorData=[];
    if (content) { 
       errorData = Object.values(JSON.parse(content));
    }
    console.log(errorData)

    //Need to see whether there are any missing fields for highlihting purposes
    const missingFields = checkForMissingFields(errorData);

    userInputJson = validateInvalidFields(errorData, userInputJson);
     
    validateInvalidValues(errorData, userInputJson);

    userInputJson = validateDateTime(errorData, userInputJson);


    console.log(JSON.stringify(userInputJson));
    //Finds error locations by getting the line numbers where $$ is present
    findErrorLines(userInputJson, errorLines);
    console.log(errorLines);

   

    //Highlighting the lines with errors
    if (!content && missingFields === false) {
      setExtensions([json({ jsx: true })]); //Hides the line highlights when succesful
    } else {
      setExtensions([classnameExt, json({ jsx: true })]); //Highlights the lines when having errors
    }

     displayErrorMessages(errorData);

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
