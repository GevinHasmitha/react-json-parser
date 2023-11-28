import './App.css';
import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { classname } from '@uiw/codemirror-extensions-classname';
import { json } from '@codemirror/lang-json';

function App() {
  const [value, setValue] = useState('');
  var errorLines = [];
  // const [submitted, setSubmitted] = useState(false);
  const [extensions, setExtensions] = useState([json({ jsx: true })]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    // document.getElementById('content').innerHTML = "";  //removes the previous content

    var userInputJson;
    try{
      userInputJson = JSON.parse(value)
    }
    catch(error){
      console.log(error.message)
      document.getElementById('errorMsg').innerHTML = `<b>Invalid JSON format: ${error.message}</b>`
      return;
    }


    const data = {
      method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(userInputJson), 
    };
    const response = await fetch('http://localhost:9090/sampleResource', data);
    const content = await response.text(); 
    console.log("Error message from server");
    console.log(content); 

    
    

    /*If the error is created by an invalid key, this will get the key where the error
    is from the error message, then this key can be used as the search string by the addPrefixToMatchingKey function*/
    const pattern1 = /field\s+'([^']+)'/g;
    const pattern1Match = content.matchAll(pattern1);

    var fieldValue = [];
    for (const match of pattern1Match){
      if (match && match.length ===2){
        fieldValue.push(match[1]);
        console.log(`Field Value  ${fieldValue}`);
      }else{
        console.log("No match found.");
      }
    }


    /*If the error is created by a value, below code is used to navigate to that field. Then it will directly 
      add $$ to that value, so calling the addPrefixToMatchingKey function is not needed (this can be done because if the error
      is with a value, the error message will contain the path, if it is with a key, we have to use the 
      addPrefixToMatchingKey function to search for the location of the key in the json)*/
    const _ = require('lodash');  //Had to use a library because value can also be nested several levels deep

    if (fieldValue){
      console.log("fieldValue = ", fieldValue);
        try {
          for (const fieldvalue of fieldValue){
            const patternz = /\w+\[\d+\].*/;   //If this matches we know there is a value error
            if (fieldvalue.match(patternz)){

               // Get the current value
              const currentValue = _.get(userInputJson, fieldvalue);
              console.log("currentValue = ", currentValue);
      
              // Modify the value
              const modifiedValue = "$$" + currentValue;
              console.log("modifiedValue = ", modifiedValue);
      
              // Set the new value
              _.set(userInputJson, fieldvalue, modifiedValue);  //Appending $$ to the key cant be done because keys are immutable so have to create a new key and append it to the json
            }else{
              continue;
            }
           
          }
        } catch (error) {
          console.error(error);
        }
    }

    //Resource type validation------------------------------------------------------

    /*This will search error for below string and if there is a match the
    error is with the resourceType field*/ 
    var pattern3 = /(Failed to find FHIR profile for the resource type)/;
    const pattern3Match = content.match(pattern3);

    if (pattern3Match && pattern3Match.length === 2) {
      fieldValue.push("resourceType");
      console.log(`Field Value : ${fieldValue}`);
    } else {
      console.log("No resource type match found.");
    }


    /*Parsing for dateTime errors*/
    var pattern4 = /\$\.(\w+):pattern/g;
    const pattern4Match = content.matchAll(pattern4);

    for( const match of pattern4Match){
      fieldValue.push(match[1]);
    }



        

    function addPrefixToMatchingKey(obj, searchString) {

      for (var key in obj) { 

        if(key === searchString || key === ""){  //if key is empty string, then the error is with the resourceType
            let entries = Object.entries(obj);   //Similar to map

            // Iterate over the array
            for (let i = 0; i < entries.length; i++) {
                if (entries[i][0] === key) {
                    // Replace the key
                    entries[i][0] = '$$' + key;
                }
            } 
            // Convert array back to object
            obj = Object.fromEntries(entries);
            return obj;
        }

        /*Here if the current key has an object as the value, this will execute*/ 
        if(typeof obj[key] === 'object' ){
          /*If the current key's value is an array containing many objects, then the else will execute therby recursively executing 
          addPrefixToMatchingKey for each object in the array. But if the current key's value is just a simple object, the the "if" will run
          executind addPrefixToMatchingKey for the current object*/
          if(!Array.isArray(obj[key])){

              var obj2 = addPrefixToMatchingKey(obj[key], searchString);
              obj[key] = obj2;

          }else{    
              for( const arrayElementIndex  in obj[key]){

                var obb = addPrefixToMatchingKey(obj[key][arrayElementIndex ], searchString);
                obj[key][arrayElementIndex ] = obb;

              }  
          }
      
        }
      }

      return obj;
    }


    for (const val of fieldValue){
      console.log(val)
    }

    // const originalJSON = JSON.stringify(userInputJson)
    // console.log("------Original object--------");
    // console.log(originalJSON);


    var jsonAfterLoop;
    for (const field of fieldValue){
      jsonAfterLoop= addPrefixToMatchingKey(userInputJson,field);
      userInputJson = jsonAfterLoop;
    }
    // const strAfterLoop = JSON.stringify(jsonAfterLoop)
    // console.log("------FInal object--------");
    // console.log(strAfterLoop);

    var jsonStringg = JSON.stringify(jsonAfterLoop, null, 2); // 2 is the number of spaces for indentation



    var numArr = [];
    if (jsonStringg){
     let linesArr = jsonStringg.split("\n");
 
     for (let i = 0; i < linesArr.length; i++){
       if (linesArr[i].includes("$$")){
         linesArr[i] = linesArr[i].replace("$$", "");
         numArr.push(i+1);
         errorLines.push(i);
 
       }
     }
     let modifiedJsonStringg = linesArr.join("\n");
    //  document.getElementById('content').innerHTML = `<pre>${modifiedJsonStringg}</pre>`;
     setValue(modifiedJsonStringg);
 }


    //Displaying the error messages  ---------------------------------------------------------------------------------   
    if (!content){
      setExtensions([ json({ jsx: true })]);  //Hides the line highlights when succesful
      document.getElementById('errorMsg').innerHTML = `<b>Validation successful</b>`
      return;
    }else{
      document.getElementById('errorMsg').innerHTML  = ""; //removes the previous content
      setExtensions([classnameExt, json({ jsx: true })]);  //Highlights the lines when having errors

      // var pattern5 = /'health\.fhir\.r4\.international401:Patient':\s*([\s\S]*)/;
      var pattern5 = /'health\.fhir\.r4\.international401:\w+':\s*([\s\S]*)/;
      const pattern5Match = content.match(pattern5)
      console.log(pattern5Match)

      if (pattern5Match !== null){
          const errorMessagesArray = pattern5Match[1].split("\n")
          for(var i=0; i<errorMessagesArray.length; i++){
            errorMessagesArray[i] = `<p>${i+1}) At line ${numArr[i]}: ${errorMessagesArray[i]} </p>`
          }
          console.log(errorMessagesArray)
          
          for (const error of errorMessagesArray){
            document.getElementById('errorMsg').innerHTML += `<b>${error}</b>`
          }
      }else{
          document.getElementById('errorMsg').innerHTML = `<b>${content}</b>`
      }  
      
    }

   // -------------------------------------------------------------------------------------------------------------
   

   

};


const classnameExt = classname({
  add: (lineNumber) => {
    for (const line of errorLines){
      if (line === lineNumber-1) {

        console.log(lineNumber);
        return 'first-line';
      }
    }

  },
});

//const extensions = submitted ? [classnameExt, json({ jsx: true })] : [json({ jsx: true })];

  return (
    <div className="App">

      <div className='container'>
        <form onSubmit={handleSubmit}>
          <CodeMirror
          className='codeMirror'
            value={value}
            height="400px"
            width='500px'
            placeholder="Enter your FHIR resource here"
            // extensions={[classnameExt, json({ jsx: true })]} 
            extensions={extensions}
            onChange={(value) => {
              setValue(value);
              if(value===""){
                setExtensions([ json({ jsx: true })]);
              }
            }}
            theme="light"
            
          />
          <button >Submit</button>
        </form>
        {/* <div id='content'></div>      */}
        <div id='errorMsg'></div>    
      </div>
    </div>
  );
}

export default App;
