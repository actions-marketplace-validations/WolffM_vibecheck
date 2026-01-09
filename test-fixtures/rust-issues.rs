// Rust test file - intentionally dirty code for static analysis
// This file triggers various Clippy warnings and lints
// WARNING: This is intentionally problematic code for testing purposes only!

#![allow(unused)]
#![allow(dead_code)]

use std::collections::HashMap;

// ============================================================================
// clippy::unwrap_used - Using unwrap() can panic
// ============================================================================

fn unwrap_example() {
    let x: Option<i32> = Some(1);
    let _ = x.unwrap(); // Triggers clippy::unwrap_used
}

fn unwrap_result() {
    let x: Result<i32, &str> = Ok(1);
    let _ = x.unwrap(); // Triggers clippy::unwrap_used
}

// ============================================================================
// clippy::expect_used - Using expect() can panic
// ============================================================================

fn expect_example() {
    let x: Result<i32, &str> = Ok(1);
    let _ = x.expect("failed"); // Triggers clippy::expect_used
}

// ============================================================================
// clippy::panic - Explicit panic calls
// ============================================================================

fn panic_example(should_panic: bool) {
    if should_panic {
        panic!("this is bad"); // Triggers clippy::panic
    }
}

fn todo_example() {
    todo!("implement this later"); // Triggers clippy::todo
}

fn unimplemented_example() {
    unimplemented!("not yet"); // Triggers clippy::unimplemented
}

// ============================================================================
// clippy::cognitive_complexity - Complex function
// ============================================================================

fn complex_function(a: i32, b: i32, c: i32, d: i32) -> i32 {
    let mut result = 0;
    if a > 0 {
        if b > 0 {
            if c > 0 {
                if d > 0 {
                    result = 1;
                } else {
                    result = 2;
                }
            } else {
                if d > 0 {
                    result = 3;
                } else {
                    result = 4;
                }
            }
        } else {
            if c > 0 {
                result = 5;
            } else {
                result = 6;
            }
        }
    } else {
        result = 7;
    }
    result
}

// ============================================================================
// clippy::too_many_arguments - Function with too many arguments
// ============================================================================

fn too_many_args(a: i32, b: i32, c: i32, d: i32, e: i32, f: i32, g: i32, h: i32) -> i32 {
    a + b + c + d + e + f + g + h
}

// ============================================================================
// clippy::needless_return - Unnecessary return statement
// ============================================================================

fn needless_return_example(x: i32) -> i32 {
    return x + 1; // Triggers clippy::needless_return
}

// ============================================================================
// clippy::clone_on_copy - Cloning a Copy type
// ============================================================================

fn clone_on_copy() {
    let x: i32 = 5;
    let _y = x.clone(); // Triggers clippy::clone_on_copy
}

// ============================================================================
// clippy::manual_map - Manual Option mapping
// ============================================================================

fn manual_map_example(x: Option<i32>) -> Option<i32> {
    match x {
        Some(v) => Some(v + 1),
        None => None,
    }
}

// ============================================================================
// clippy::single_match - Single match arm could be if let
// ============================================================================

fn single_match_example(x: Option<i32>) {
    match x {
        Some(v) => println!("{}", v),
        _ => {}
    }
}

// ============================================================================
// clippy::redundant_closure - Redundant closure
// ============================================================================

fn redundant_closure_example() {
    let v = vec![1, 2, 3];
    let _: Vec<String> = v.iter().map(|x| x.to_string()).collect();
}

// ============================================================================
// clippy::cast_possible_truncation - Casting that may truncate
// ============================================================================

fn cast_truncation() {
    let x: i64 = 1_000_000_000_000;
    let _y: i32 = x as i32; // Triggers clippy::cast_possible_truncation
}

// ============================================================================
// clippy::cast_sign_loss - Casting that may lose sign
// ============================================================================

fn cast_sign_loss() {
    let x: i32 = -5;
    let _y: u32 = x as u32; // Triggers clippy::cast_sign_loss
}

// ============================================================================
// clippy::string_add - Using + for string concatenation
// ============================================================================

fn string_add() {
    let s1 = String::from("Hello, ");
    let s2 = String::from("world!");
    let _s3 = s1 + &s2; // Inefficient string concatenation
}

// ============================================================================
// clippy::ptr_arg - Using &Vec instead of &[T]
// ============================================================================

fn ptr_arg_example(v: &Vec<i32>) -> i32 {
    v.iter().sum()
}

// ============================================================================
// clippy::len_zero - Using .len() == 0 instead of .is_empty()
// ============================================================================

fn len_zero_example(v: &[i32]) -> bool {
    v.len() == 0 // Triggers clippy::len_zero
}

// ============================================================================
// clippy::collapsible_if - Nested ifs that can be collapsed
// ============================================================================

fn collapsible_if(a: bool, b: bool) {
    if a {
        if b {
            println!("both true");
        }
    }
}

// ============================================================================
// Unsafe code examples
// ============================================================================

unsafe fn unsafe_function() {
    // This is unsafe
}

fn calls_unsafe() {
    unsafe {
        unsafe_function();
    }
}

// ============================================================================
// clippy::missing_safety_doc - Unsafe function without safety docs
// ============================================================================

/// This function does something unsafe but doesn't document safety requirements
pub unsafe fn missing_safety_doc(ptr: *const i32) -> i32 {
    *ptr // Dereference raw pointer
}

// ============================================================================
// clippy::mut_from_ref - Mutable reference from immutable
// ============================================================================

// This pattern is dangerous but may not trigger without specific context
fn dangerous_ref_patterns() {
    let x = 5;
    let _ptr = &x as *const i32;
}

// ============================================================================
// Main function to use the code
// ============================================================================

fn main() {
    // Call some functions to prevent dead_code warnings
    unwrap_example();
    expect_example();
    let _ = complex_function(1, 2, 3, 4);
    let _ = too_many_args(1, 2, 3, 4, 5, 6, 7, 8);
    let _ = needless_return_example(5);
    clone_on_copy();
    let _ = manual_map_example(Some(5));
    single_match_example(Some(5));
    redundant_closure_example();
    cast_truncation();
    cast_sign_loss();
    string_add();
    let v = vec![1, 2, 3];
    let _ = ptr_arg_example(&v);
    let _ = len_zero_example(&v);
    collapsible_if(true, true);
    calls_unsafe();
    dangerous_ref_patterns();
}
